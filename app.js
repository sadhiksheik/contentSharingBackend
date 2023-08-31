const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(cors())
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
app.use(express.json());

const dbPath = path.join(__dirname, "mydb.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
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
        request.user_id = payload.user_id
        next();
      }
    });
  }
};
//register
app.post("/register", async (request, response) => {
  const { name,password} = request.body;
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
      await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
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
    const passwordMatched = await bcrypt.compare(
      password,
      dbUser.password
    );
    if (passwordMatched === true) {
      const playload = {
        name: name,
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
app.get("/posts",authenticateToken, async (request, response) =>{
  const getPostsQuery = `
  SELECT * FROM posts
  `
  const allposts = await db.all(getPostsQuery);
   response.send(allposts);
})
//get user posts
app.get("/posts/:user_id/",authenticateToken, async (request, response) => {
  const { user_id } = request.params;
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
  const { post_text, likes, user_id } = postDetails;
  console.log(post_text);
  
  const createPostQuery = `
    INSERT INTO
      posts (post_text, likes, user_id)
    VALUES
      (?, ?, ?);`;

  // Use parameters to safely insert data
  await db.run(createPostQuery, [post_text, likes, user_id]);
  
  response.send("Post Successfully Added");
});

//update post (edit)
app.put("/posts/:post_id/",authenticateToken, async (request, response) => {
  const { post_id } = request.params;
  const postDetails = request.body;
  const { post_text} = postDetails;

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

//delete post 
app.delete("/posts/:post_id/",authenticateToken, async (request, response) => {
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