import Dexie, { type Table } from 'dexie';

export interface StudyGuide {
  id?: number;
  title: string;
  certification: string; // e.g. "Security+", "CCNA", "AWS SAA"
  createdAt: number;
  sourceFileName: string;
}

export interface Topic {
  id?: number;
  guideId: number;
  heading: string;
  order: number;
  content: string; // plain text body under this heading
  flagged?: boolean; // marked "hard" by the learner for a dedicated review queue
}

export interface Flashcard {
  id?: number;
  guideId: number;
  topicId: number;
  front: string;
  back: string;
  // SM-2 spaced repetition state
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: number; // epoch ms
  lastReviewedAt?: number;
}

export interface QuizQuestion {
  id?: number;
  guideId: number;
  topicId: number;
  question: string;
  choices: string[];
  correctIndex: number;
}

export interface QuizAttempt {
  id?: number;
  guideId: number;
  takenAt: number;
  totalQuestions: number;
  correctCount: number;
}

export interface ReviewLog {
  id?: number;
  flashcardId: number;
  reviewedAt: number;
  quality: number; // 0-5 SM-2 grade
}

class StudyHubDB extends Dexie {
  guides!: Table<StudyGuide, number>;
  topics!: Table<Topic, number>;
  flashcards!: Table<Flashcard, number>;
  quizQuestions!: Table<QuizQuestion, number>;
  quizAttempts!: Table<QuizAttempt, number>;
  reviewLogs!: Table<ReviewLog, number>;

  constructor() {
    super('studyHubDB');
    this.version(1).stores({
      guides: '++id, certification, createdAt',
      topics: '++id, guideId, order',
      flashcards: '++id, guideId, topicId, dueAt',
      quizQuestions: '++id, guideId, topicId',
      quizAttempts: '++id, guideId, takenAt',
      reviewLogs: '++id, flashcardId, reviewedAt',
    });
  }
}

export const db = new StudyHubDB();
