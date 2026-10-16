// server/data/db.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { getInitialData } from './seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

class Database {
  constructor() {
    this.data = null;
    this.mongoClient = null;
    this.mongoCollection = null;
    this.mongoStateId = process.env.MONGODB_STATE_ID || 'sharp-demo-state';
    this.ready = this.init();
  }

  async init() {
    const fileData = this.loadFromFile();
    this.data = fileData || getInitialData();

    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
      try {
        this.mongoClient = new MongoClient(mongoUri);
        await this.mongoClient.connect();
        const dbName = process.env.MONGODB_DB || 'sharp_hostel_portal';
        const collectionName = process.env.MONGODB_COLLECTION || 'app_state';
        this.mongoCollection = this.mongoClient.db(dbName).collection(collectionName);

        const storedState = await this.mongoCollection.findOne({ _id: this.mongoStateId });
        if (storedState?.data) {
          this.data = storedState.data;
          this.saveToFile();
          console.log(`MongoDB persistence enabled: loaded state "${this.mongoStateId}" from ${dbName}.${collectionName}`);
        } else {
          await this.saveToMongo();
          console.log(`MongoDB persistence enabled: seeded state "${this.mongoStateId}" in ${dbName}.${collectionName}`);
        }
      } catch (err) {
        console.error('MongoDB connection failed. Falling back to db.json persistence:', err.message);
        this.mongoClient = null;
        this.mongoCollection = null;
      }
    }

    if (!fileData && !this.mongoCollection) {
      this.saveToFile();
    }
  }

  loadFromFile() {
    if (!fs.existsSync(DB_PATH)) return null;
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error reading db.json, falling back to seed data:', err);
      return null;
    }
  }

  saveToFile() {
    try {
      const tempPath = `${DB_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_PATH);
    } catch (err) {
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
      } catch (fallbackErr) {
        console.error('Failed to write DB:', fallbackErr);
      }
    }
  }

  async saveToMongo() {
    if (!this.mongoCollection) return;
    try {
      await this.mongoCollection.replaceOne(
        { _id: this.mongoStateId },
        { _id: this.mongoStateId, data: this.data, updatedAt: new Date() },
        { upsert: true }
      );
    } catch (err) {
      console.error('Failed to persist state to MongoDB:', err.message);
    }
  }

  save() {
    this.saveToFile();
    if (this.mongoCollection) {
      this.saveToMongo();
    }
  }

  reset() {
    this.data = getInitialData();
    this.save();
    return this.data;
  }

  // Generic collection helpers
  getCollection(name) {
    if (!this.data[name]) {
      this.data[name] = [];
    }
    return this.data[name];
  }

  findById(collectionName, id) {
    const coll = this.getCollection(collectionName);
    return coll.find(item => item.id === id) || null;
  }

  find(collectionName, predicate) {
    const coll = this.getCollection(collectionName);
    return coll.filter(predicate);
  }

  findOne(collectionName, predicate) {
    const coll = this.getCollection(collectionName);
    return coll.find(predicate) || null;
  }

  insert(collectionName, item) {
    const coll = this.getCollection(collectionName);
    if (!item.id) {
      item.id = `${collectionName.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    coll.push(item);
    this.save();
    return item;
  }

  update(collectionName, id, updates) {
    const coll = this.getCollection(collectionName);
    const index = coll.findIndex(item => item.id === id);
    if (index === -1) return null;
    coll[index] = { ...coll[index], ...updates };
    this.save();
    return coll[index];
  }

  delete(collectionName, id) {
    const coll = this.getCollection(collectionName);
    const index = coll.findIndex(item => item.id === id);
    if (index === -1) return false;
    coll.splice(index, 1);
    this.save();
    return true;
  }

  // Specific singletons
  getConfig() {
    return this.data.allocationConfig;
  }

  updateConfig(updates) {
    this.data.allocationConfig = { ...this.data.allocationConfig, ...updates };
    this.save();
    return this.data.allocationConfig;
  }

  getActiveSemester() {
    const semesters = this.getCollection('semesters');
    return semesters.find(s => s.status === 'ACTIVE') || semesters[0];
  }

  updateActiveSemesterPhase(phaseNumber) {
    const activeSem = this.getActiveSemester();
    if (activeSem) {
      activeSem.activePhase = phaseNumber;
      this.save();
    }
    return activeSem;
  }

  startAllotmentPhase(phase = 1) {
    const activeSem = this.getActiveSemester();
    if (activeSem) {
      activeSem.allotmentStatus = 'ACTIVE';
      activeSem.activePhase = phase;
      activeSem.allocationStartDate = new Date().toISOString();
      this.save();
    }
    return activeSem;
  }

  endAllotmentPhase() {
    const activeSem = this.getActiveSemester();
    if (activeSem) {
      activeSem.allotmentStatus = 'ENDED';
      activeSem.allocationEndDate = new Date().toISOString();
      this.save();
    }
    return activeSem;
  }

  resetAllotmentPhase() {
    const activeSem = this.getActiveSemester();
    if (activeSem) {
      activeSem.allotmentStatus = 'NOT_STARTED';
      activeSem.activePhase = 1;
      this.save();
    }
    return activeSem;
  }
}

export const db = new Database();
