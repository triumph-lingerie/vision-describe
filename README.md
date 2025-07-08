# Vision Describe

An advanced AI-powered tool that generates professional product descriptions from images using OpenAI's GPT-4 Vision API. Perfect for e-commerce businesses looking to create compelling, multilingual product content at scale.

## Features

- **AI Image Analysis**: Upload product photos and get detailed, marketing-ready descriptions
- **URL Crawling**: Extract and enhance existing product descriptions from web pages
- **Multilingual Support**: Generate content in all major European languages
- **Category-Specific**: Tailored descriptions for different product categories
- **Professional Quality**: SEO-optimized content following premium brand standards
- **Compliance Ready**: GDPR compliant with privacy policy and terms of service

## Tech Stack

- **Frontend**: React 18 + TypeScript + Shadcn/UI + Tailwind CSS
- **Backend**: Node.js + Express + OpenAI API
- **Database**: PostgreSQL with Drizzle ORM
- **Build Tool**: Vite
- **Deployment**: Vercel-ready

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/triumph-lingerie/ai-product-description-generator.git
cd ai-product-description-generator
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` and add your API keys:
- `OPENAI_API_KEY`: Required for image analysis
- `FIRECRAWL_API_KEY`: Optional, for URL crawling

### 4. Start development server
```bash
npm run dev
```

## Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `OPENAI_API_KEY`
   - `FIRECRAWL_API_KEY` (optional)
   - `DATABASE_URL` (if using PostgreSQL)
3. Deploy automatically on push to main branch

### Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key for GPT-4 Vision
- `FIRECRAWL_API_KEY`: Firecrawl API key for web scraping (optional)
- `DATABASE_URL`: PostgreSQL connection string (optional, uses in-memory storage by default)
- `NODE_ENV`: Set to `production` for production deployment

## Usage

### Create New Descriptions
1. Configure language, category, and certifications
2. Upload up to 10 product images
3. AI analyzes images and generates professional descriptions
4. Copy or export results

### Enhance Existing Products
1. Enter product URL
2. System crawls page and extracts images
3. AI enhances existing descriptions with visual analysis
4. Get improved, SEO-optimized content

## API Endpoints

- `POST /api/images/analyze` - Analyze uploaded images
- `GET /api/images` - Get all analyses
- `GET /api/images/:id` - Get specific analysis
- `POST /api/crawl` - Crawl and analyze URL

## Security Features

- Rate limiting (10 requests per hour per IP)
- Content filtering for inappropriate uploads
- GDPR-compliant data handling
- Secure API key management
- Audit logging

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please use GitHub Issues.