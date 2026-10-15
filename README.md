# InstaFlux — Full-Stack Social Media Platform
**Stack:** Java 21 + Spring Boot 3.3 | Angular 18 | PostgreSQL 16 | Redis 7 | Apache Kafka 3.7 | OAuth2 / OIDC (Keycloak / Google / GitHub)

---

## Architecture Overview

1. **Angular 18 Frontend (`frontend/`)**:
   - Standalone Signals-based reactive UI (`instaflux.ng.ts` / full Angular CLI workspace)
   - OAuth2 Authorization Code + PKCE flow with automatic Bearer JWT attachment
   - Optimistic UI updates for Likes, Comments, Bookmarks, Stories, and Follows

2. **Java Spring Boot 3 Backend (`backend/`)**:
   - **Security (`SecurityConfig.java`)**: Spring Security 6 OAuth2 Resource Server (RS256 JWT validation via JWK Set URI) + OAuth2 Client login + Redis-backed sliding-window Rate Limiting filter (`RateLimitingFilter.java`)
   - **PostgreSQL 16 (`domain/` & `repository/`)**: Flyway-managed relational schema (`users`, `posts`, `post_likes`, `comments`, `follows`, `stories`) with Spring Data JPA
   - **Redis 7 (`service/RedisFeedCacheService.java`)**: Timeline feed caching (`feed:timeline:{userId}`), atomic post counters (`HINCRBY post:metrics:{postId}`), and distributed rate limiting
   - **Apache Kafka (`messaging/KafkaEventProducer.java` & `KafkaEventConsumer.java`)**: Asynchronous event streaming across `social.post.created`, `social.interaction.liked`, and `social.notification.fanout` topics for timeline fan-out and real-time notifications

---

## Quick Start (Local via Docker Compose)

```bash
docker compose up --build -d
```

- **Angular Web App**: `http://localhost:4200`
- **Spring Boot REST API**: `http://localhost:8080/api/v1`
- **Keycloak OAuth2 / OIDC Server**: `http://localhost:8180` (Realm: `instaflux`)
- **PostgreSQL 16**: `localhost:5432` (`instaflux_db`)
- **Redis 7**: `localhost:6379`
- **Apache Kafka**: `localhost:9092`

---

## How to Get a Live Public Link (Free Cloud Deployment)

1. **Push this repository to GitHub.**
2. **Backend + PostgreSQL + Redis (Render.com / Railway.app)**:
   - On **Railway.app** or **Render.com**, click **New Project -> Deploy from GitHub repo** (or use the included `docker-compose.yml` / `backend/Dockerfile`).
   - Provision managed **PostgreSQL**, **Redis**, and **Kafka (Upstash Kafka / Confluent Cloud)** and set the environment variables shown in `.env.example`.
3. **Frontend (Vercel / Netlify / Render Static Site)**:
   - Connect the `frontend/` directory, set `API_BASE_URL` to your deployed Spring Boot URL, and deploy to receive an instant `https://<your-app>.vercel.app` link.
