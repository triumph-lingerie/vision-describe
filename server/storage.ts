import { users, imageAnalyses, type User, type InsertUser, type InsertImageAnalysis, type ImageAnalysis } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createImageAnalysis(analysis: InsertImageAnalysis): Promise<ImageAnalysis>;
  getImageAnalyses(): Promise<ImageAnalysis[]>;
  getImageAnalysis(id: number): Promise<ImageAnalysis | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private imageAnalyses: Map<number, ImageAnalysis>;
  private userCurrentId: number;
  private analysisCurrentId: number;

  constructor() {
    this.users = new Map();
    this.imageAnalyses = new Map();
    this.userCurrentId = 1;
    this.analysisCurrentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createImageAnalysis(insertAnalysis: InsertImageAnalysis): Promise<ImageAnalysis> {
    const id = this.analysisCurrentId++;
    const analysis: ImageAnalysis = { 
      ...insertAnalysis, 
      id, 
      createdAt: new Date() 
    };
    this.imageAnalyses.set(id, analysis);
    return analysis;
  }

  async getImageAnalyses(): Promise<ImageAnalysis[]> {
    return Array.from(this.imageAnalyses.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getImageAnalysis(id: number): Promise<ImageAnalysis | undefined> {
    return this.imageAnalyses.get(id);
  }
}

export const storage = new MemStorage();
