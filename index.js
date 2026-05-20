const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
dotenv.config();
const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(new URL("http://localhost:3000/api/auth/jwks"));

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Forbidden" });
  }

  
};

async function run() {
  try {
    await client.connect();

    const db = client.db("FurEver");
    const petCollection = db.collection("pets");

    const petAdoptingCollection = db.collection("petAdopting");

    app.get("/pet", async (req, res) => {
      const result = await petCollection.find().toArray();
      res.json(result);
    });

    app.post("/pet", verifyToken, async (req, res) => {
      const petData = req.body;
      const result = await petCollection.insertOne(petData);
      res.json(result);
    });

    app.get("/pet/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await petCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.patch("/pet/:id", verifyToken
      , async (req, res) => {
      const { id } = req.params;
      const updatedPet = req.body;
      const result = await petCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedPet },
      );
      res.json(result);
    });

    app.delete("/pet/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await petCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.get("/adopting/:userId", verifyToken, async (req, res) => {
      const { userId } = req.params;
      const result = await petAdoptingCollection
        .find({ userId: userId })
        .toArray();
      res.json(result);
    });

    app.get("/adopting/check/:userId/:petId", async (req, res) => {
      const { userId, petId } = req.params;

      const result = await petAdoptingCollection.findOne({
        userId,
        petId,
      });

      res.json(result);
    });

    app.post("/adopting", verifyToken, async (req, res) => {
      const petAdopting = req.body;
      const result = await petAdoptingCollection.insertOne(petAdopting);

      res.json(result);
    });

    app.get("/adopting/pet/:petId", verifyToken, async (req, res) => {
      const { petId } = req.params;

      const result = await petAdoptingCollection.find({ petId }).toArray();

      res.json(result);
    });

    app.patch("/adopting/:id/status", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { status, petId } = req.body;

      const result = await petAdoptingCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } },
      );

      if (status === "approved" && petId) {
        await petCollection.updateOne(
          { _id: new ObjectId(petId) },
          { $set: { status: "adopted" } },
        );

        await petAdoptingCollection.updateMany(
          { petId, _id: { $ne: new ObjectId(id) } },
          { $set: { status: "rejected" } },
        );
      }

      res.json(result);
    });

    app.delete("/adopting/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      const result = await petAdoptingCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
