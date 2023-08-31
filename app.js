const express = require("express");
const path = require("path");
const cors = require("cors");

// const bp = require("body-parser");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
app.use(express.json());

const dbPath = path.join(__dirname, "mydb.db");
let db = null;

app.use(cors());

// app.use(bp.json());
// app.use(bp.urlencoded({ extended: true }));

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3003, () => {
      console.log("Server Running at http://localhost:3003/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//authentication
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.user_id = payload.user_id;
        next();
      }
    });
  }
};
//register
app.post("/register", async (request, response) => {
  const { name, password } = request.body;

  console.log(name, password);

  const getUserQuery = `
    SELECT
        *
     FROM 
        users
     WHERE
        name = '${name}';`;
  const dbUser = await db.get(getUserQuery);

  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
            INSERT INTO 
                users (name, password) 
            VALUES 
            (
            '${name}',
            '${hashedPassword}'
            )`;
      const dbResponse = await db.run(createUserQuery);
      const userId = dbResponse.lastID;
      response.send({ user_id: userId });
      response.status(200);
      // response.send("User created successfully");
    }
  }
});

//login
app.post("/login/", async (request, response) => {
  const { name, password } = request.body;
  const selectUserQuery = `
    SELECT
        *
    FROM 
        users
    WHERE 
        name ='${name}';
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordMatched = await bcrypt.compare(password, dbUser.password);
    if (passwordMatched === true) {
      const playload = {
        user_id: dbUser.user_id,
      };
      const jwtToken = jwt.sign(playload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//get all posts
app.get("/posts", authenticateToken, async (request, response) => {
  const getPostsQuery = `
  SELECT * FROM posts
  `;
  const allposts = await db.all(getPostsQuery);
  response.send(allposts);
});

//get user posts
app.get("/myposts/", authenticateToken, async (request, response) => {
  const { user_id } = request;
  // console.log(request)
  const getUserPosts = ` 
        SELECT
            *
        FROM
            posts
        WHERE
            user_id = ${user_id};`;
  const userPosts = await db.all(getUserPosts);
  response.send(userPosts);
});

//create post
app.post("/posts", authenticateToken, async (request, response) => {
  const postDetails = request.body;
  const { user_id } = request;
  const { post_text, likes, user_name } = postDetails;
  console.log(post_text);

  const createPostQuery = `
    INSERT INTO
      posts (post_text, likes, user_id, user_name)
    VALUES
      (
        '${post_text}',
        ${likes},
        ${user_id},
        '${user_name}'
      );`;

  await db.run(createPostQuery);

  response.send("Post Successfully Added");
});

//update post (edit)
app.put("/posts/:post_id/", authenticateToken, async (request, response) => {
  const { post_id } = request.params;
  const postDetails = request.body;
  const { post_text } = postDetails;

  const updatePostQuery = ` 
    UPDATE 
        posts
     SET
        post_text = '${post_text}'
    WHERE
        post_id = ${post_id};`;
  await db.run(updatePostQuery);
  response.send(`Post Updated`);
});
//like post 
app.put("/like/:post_id/", authenticateToken, async (request, response) => {
  const { post_id } = request.params;
  const postDetails = request.body;
  const { likes } = postDetails;

  const updatePostQuery = ` 
    UPDATE 
        posts
     SET
        likes = ${likes}
    WHERE
        post_id = ${post_id};`;
  await db.run(updatePostQuery);
  response.send(`Likes Updated`);
});

//delete post
app.delete("/posts/:post_id/", authenticateToken, async (request, response) => {
  const { post_id } = request.params;
  const deleteQuery = `
    DELETE FROM 
        posts 
     WHERE 
        post_id = ${post_id};`;
  await db.run(deleteQuery);
  response.send("Post Deleted");
});

module.exports = app;
