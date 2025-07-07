# AI Image Analysis Application

## Overview

This is a full-stack web application that allows users to upload images and receive AI-powered descriptions using OpenAI's GPT-4 Vision model. The application features a modern React frontend with a Node.js/Express backend, utilizing PostgreSQL for data persistence and Drizzle ORM for database operations.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **File Upload**: Multer for handling multipart form data
- **API Integration**: OpenAI GPT-4 Vision for image analysis
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: Express sessions with PostgreSQL store

### Data Storage
- **Primary Database**: PostgreSQL with Neon Database serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations
- **Fallback Storage**: In-memory storage implementation for development

## Key Components

### Database Schema
- **Users Table**: Basic user management with username/password
- **Image Analyses Table**: Stores uploaded image metadata and AI-generated descriptions
  - Filename, original name, MIME type, file size
  - AI-generated description text
  - Creation timestamp

### API Endpoints
- `POST /api/images/analyze`: Upload and analyze multiple images
  - Accepts up to 10 images (10MB limit each)
  - Returns AI analysis results for each image
  - Handles errors gracefully for individual files

### Frontend Components
- **ImageUpload**: Drag-and-drop interface for file uploads with progress tracking
- **ImageResult**: Display component for analysis results with copy/export functionality
- **Theme Provider**: Light/dark mode support with system preference detection

## Data Flow

1. **Image Upload**: Users drag/drop or select images through the upload interface
2. **File Processing**: Multer processes uploaded files into memory buffers
3. **AI Analysis**: Images are converted to base64 and sent to OpenAI GPT-4 Vision
4. **Data Persistence**: Analysis results are stored in PostgreSQL database
5. **Result Display**: Frontend displays results with options to copy or export descriptions

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database driver
- **drizzle-orm**: Type-safe ORM and query builder
- **openai**: Official OpenAI API client
- **multer**: File upload middleware
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React router

### UI Dependencies
- **@radix-ui/***: Headless UI components for accessibility
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Tools
- **vite**: Build tool and development server
- **typescript**: Type safety and development experience
- **drizzle-kit**: Database schema management

## Deployment Strategy

### Build Process
- Frontend builds to `dist/public` using Vite
- Backend builds to `dist/index.js` using esbuild
- Single production command serves both frontend and API

### Environment Requirements
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API authentication
- Node.js runtime for Express server

### Development Setup
- `npm run dev`: Starts development server with hot reload
- `npm run db:push`: Applies database schema changes
- `npm run build`: Creates production build
- `npm start`: Runs production server

## Changelog
- July 07, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.