import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';

interface CommentItem {
  id: string;
  authorUsername: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
}

interface PostItem {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string;
  authorVerified: boolean;
  location: string;
  caption: string;
  category: 'Architecture' | 'Cyberpunk' | 'Nature' | 'Portrait' | 'Code & Tech';
  filterClass: string;
  filterLabel: string;
  svgScene: string;
  likes: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  createdAt: string;
  comments: CommentItem[];
}

interface StoryItem {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  title: string;
  subtitle: string;
  gradient: string;
  viewed: boolean;
  createdAt: string;
}

interface UserProfile {
  id: string;
  oauthSub: string;
  provider: 'Keycloak OIDC' | 'Google OAuth2' | 'GitHub OAuth2';
  username: string;
  displayName: string;
  email: string;
  bio: string;
  avatar: string;
  verified: boolean;
  followers: number;
  following: number;
  isFollowedByMe?: boolean;
}

interface KafkaEventLog {
  id: string;
  topic: 'social.post.created' | 'social.interaction.liked' | 'social.notification.fanout' | 'social.auth.audit';
  partition: number;
  offset: number;
  key: string;
  eventType: string;
  payload: string;
  timestamp: string;
}

interface RedisCacheEntry {
  key: string;
  type: 'STRING (JSON)' | 'HASH (Counters)' | 'COUNTER (RateLimit)';
  ttlSeconds: number;
  valuePreview: string;
  lastUpdated: string;
}

interface ApiTraceLog {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  status: number;
  latencyMs: number;
  cacheOutcome: 'REDIS_HIT' | 'REDIS_MISS -> PG_QUERY' | 'REDIS_WRITE + KAFKA_PUB' | 'OAUTH2_TOKEN_EXCHANGE';
  timestamp: string;
}

interface DirectMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  fromMe: boolean;
}

interface ChatThread {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  status: string;
  messages: DirectMessage[];
}

@Component({
  standalone: true,
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    .story-ring {
      background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
    }
    .filter-normal { filter: none; }
    .filter-vivid { filter: saturate(1.45) contrast(1.1); }
    .filter-noir { filter: grayscale(0.95) contrast(1.25); }
    .filter-warm { filter: sepia(0.35) saturate(1.3) brightness(1.05); }
    .filter-cyber { filter: hue-rotate(35deg) saturate(1.5) contrast(1.15); }
    @keyframes popHeart {
      0% { transform: scale(0.6); opacity: 0.4; }
      50% { transform: scale(1.28); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .animate-heart {
      animation: popHeart 0.28s ease-out;
    }
  `,
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <!-- Top OAuth2 + Spring Boot + Redis + Kafka Architecture Status Banner -->
      <div class="bg-slate-900/95 border-b border-slate-800 px-3 py-2 text-xs">
        <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Spring Boot 3.3 API: UP
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
              OAuth2: {{ currentUser().provider }} (RS256 JWT)
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium">
              Redis 7: {{ redisHitRate() }}% HIT | RateLimit {{ rateLimitUsed() }}/100 rpm
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
              Kafka: {{ kafkaEvents().length }} events streamed
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium">
              PostgreSQL 16: {{ posts().length }} posts / {{ totalCommentsCount() }} comments
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="setActiveTab('architecture')"
              class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition font-medium">
              Inspect Backend &amp; Code
            </button>
            <button
              type="button"
              (click)="setActiveTab('oauth')"
              class="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition font-medium">
              OAuth2 Token
            </button>
          </div>
        </div>
      </div>

      <!-- Toast Notification -->
      @if (toastMessage()) {
        <div class="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 border border-indigo-500/50 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-start gap-3">
          <div class="w-2.5 h-2.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
          <div class="text-xs leading-relaxed flex-1">{{ toastMessage() }}</div>
          <button
            type="button"
            (click)="clearToast()"
            class="text-slate-400 hover:text-white text-xs font-semibold px-1">
            ✕
          </button>
        </div>
      }

      <!-- Main Layout Shell -->
      <div class="max-w-7xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 px-3 sm:px-6 py-5">
        <!-- Left Sidebar Navigation -->
        <aside class="lg:col-span-3 flex flex-col justify-between bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 h-fit lg:sticky lg:top-5">
          <div>
            <!-- Brand Header -->
            <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl story-ring flex items-center justify-center shadow-lg">
                  <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </div>
                <div>
                  <h1 class="text-lg font-bold tracking-tight text-white">InstaFlux</h1>
                  <p class="text-[11px] text-slate-400">Angular 18 + Spring Boot 3</p>
                </div>
              </div>
              <button
                type="button"
                (click)="openCreateModal()"
                class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-600 hover:to-amber-600 text-white text-xs font-semibold shadow-md transition">
                + New Post
              </button>
            </div>

            <!-- Navigation Links -->
            <nav class="space-y-1.5">
              <button
                type="button"
                (click)="setActiveTab('feed')"
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition {{ activeTab() === 'feed' ? 'bg-gradient-to-r from-pink-500/20 to-indigo-500/20 text-white border border-pink-500/30' : 'text-slate-300 hover:bg-slate-800/70' }}">
                <span class="flex items-center gap-3">
                  <span>🏠</span>
                  <span>Home Feed</span>
                </span>
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{{ posts().length }}</span>
              </button>

              <button
                type="button"
                (click)="setActiveTab('explore')"
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition {{ activeTab() === 'explore' ? 'bg-gradient-to-r from-pink-500/20 to-indigo-500/20 text-white border border-pink-500/30' : 'text-slate-300 hover:bg-slate-800/70' }}">
                <span class="flex items-center gap-3">
                  <span>🧭</span>
                  <span>Explore &amp; Search</span>
                </span>
                <span class="text-[11px] text-slate-400">Grid</span>
              </button>

              <button
                type="button"
                (click)="setActiveTab('messages')"
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition {{ activeTab() === 'messages' ? 'bg-gradient-to-r from-pink-500/20 to-indigo-500/20 text-white border border-pink-500/30' : 'text-slate-300 hover:bg-slate-800/70' }}">
                <span class="flex items-center gap-3">
                  <span>💬</span>
                  <span>Direct Messages</span>
                </span>
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300">{{ threads().length }}</span>
              </button>

              <button
                type="button"
                (click)="setActiveTab('profile')"
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition {{ activeTab() === 'profile' ? 'bg-gradient-to-r from-pink-500/20 to-indigo-500/20 text-white border border-pink-500/30' : 'text-slate-300 hover:bg-slate-800/70' }}">
                <span class="flex items-center gap-3">
                  <span>👤</span>
                  <span>My Profile &amp; Saved</span>
                </span>
                <span class="text-[11px] text-slate-400">&#64;{{ currentUser().username }}</span>
              </button>

              <button
                type="button"
                (click)="setActiveTab('oauth')"
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition {{ activeTab() === 'oauth' ? 'bg-gradient-to-r from-indigo-500/25 to-sky-500/20 text-white border border-indigo-500/40' : 'text-slate-300 hover:bg-slate-800/70' }}">
                <span class="flex items-center gap-3">
                  <span>🔐</span>
                  <span>OAuth2 &amp; Security</span>
                </span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">PKCE</span>
              </button>

              <button
                type="button"
                (click)="setActiveTab('architecture')"
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition {{ activeTab() === 'architecture' ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/20 text-white border border-emerald-500/40' : 'text-slate-300 hover:bg-slate-800/70' }}">
                <span class="flex items-center gap-3">
                  <span>⚡</span>
                  <span>Redis / Kafka / PG Console</span>
                </span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Live</span>
              </button>
            </nav>
          </div>

          <!-- Current Authenticated User Card -->
          <div class="mt-6 pt-4 border-t border-slate-800">
            <div class="flex items-center gap-3">
              <img
                [src]="currentUser().avatar"
                alt="User avatar"
                class="w-10 h-10 rounded-full object-cover border border-pink-500/50" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                  <p class="text-sm font-semibold text-white truncate">{{ currentUser().displayName }}</p>
                  @if (currentUser().verified) {
                    <span class="text-sky-400 text-xs" title="OAuth2 Verified">✔</span>
                  }
                </div>
                <p class="text-xs text-slate-400 truncate">&#64;{{ currentUser().username }} · {{ currentUser().provider }}</p>
              </div>
            </div>
          </div>
        </aside>

        <!-- Center Content Column -->
        <main class="lg:col-span-6 space-y-6">
          <!-- TAB 1: HOME FEED -->
          @if (activeTab() === 'feed') {
            <!-- Stories Bar -->
            <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-400">24h Stories (Redis TTL Cached)</h2>
                <button
                  type="button"
                  (click)="addQuickStory()"
                  class="text-xs text-pink-400 hover:text-pink-300 font-medium">
                  + Add Story
                </button>
              </div>
              <div class="flex items-center gap-4 overflow-x-auto pb-1">
                @for (story of stories(); track story.id) {
                  <button
                    type="button"
                    (click)="openStory(story)"
                    class="flex flex-col items-center gap-1.5 shrink-0 group">
                    <div class="p-0.5 rounded-full {{ story.viewed ? 'bg-slate-700' : 'story-ring' }} transition transform group-hover:scale-105">
                      <div class="p-0.5 bg-slate-950 rounded-full">
                        <img [src]="story.avatar" [alt]="story.username" class="w-14 h-14 rounded-full object-cover" />
                      </div>
                    </div>
                    <span class="text-[11px] text-slate-300 max-w-[70px] truncate">{{ story.username }}</span>
                  </button>
                }
              </div>
            </section>

            <!-- Feed Filter & Cache Refresh Bar -->
            <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                @for (cat of categories; track cat) {
                  <button
                    type="button"
                    (click)="setSelectedCategory(cat)"
                    class="px-2.5 py-1 rounded-lg text-xs font-medium transition {{ selectedCategory() === cat ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700' }}">
                    {{ cat }}
                  </button>
                }
              </div>
              <button
                type="button"
                (click)="refreshFeedFromBackend()"
                class="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition">
                ↻ Sync GET /api/v1/posts/feed
              </button>
            </div>

            <!-- Posts List -->
            <div class="space-y-6">
              @for (post of filteredPosts(); track post.id) {
                <article class="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                  <!-- Post Header -->
                  <div class="flex items-center justify-between px-4 py-3">
                    <div class="flex items-center gap-3">
                      <img [src]="post.authorAvatar" [alt]="post.authorUsername" class="w-10 h-10 rounded-full object-cover border border-slate-700" />
                      <div>
                        <div class="flex items-center gap-1.5">
                          <span class="text-sm font-semibold text-white">{{ post.authorUsername }}</span>
                          @if (post.authorVerified) {
                            <span class="text-sky-400 text-xs">✔</span>
                          }
                          <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{{ post.category }}</span>
                        </div>
                        <p class="text-xs text-slate-400">{{ post.location }} · {{ post.createdAt }}</p>
                      </div>
                    </div>
                    <span class="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-400 border border-slate-700">
                      Filter: {{ post.filterLabel }}
                    </span>
                  </div>

                  <!-- Post Visual Artwork (Double-click or button to Like) -->
                  <div
                    (dblclick)="toggleLike(post.id)"
                    class="relative bg-slate-950 aspect-[4/3] w-full overflow-hidden cursor-pointer select-none">
                    <img
                      [src]="post.svgScene"
                      [alt]="post.caption"
                      class="w-full h-full object-cover transition duration-300 {{ post.filterClass }}" />
                  </div>

                  <!-- Post Actions Bar -->
                  <div class="p-4 space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-4">
                        <button
                          type="button"
                          (click)="toggleLike(post.id)"
                          class="flex items-center gap-1.5 text-sm font-semibold transition {{ post.likedByMe ? 'text-rose-500 animate-heart' : 'text-slate-300 hover:text-white' }}">
                          <span class="text-lg">{{ post.likedByMe ? '❤️' : '🤍' }}</span>
                          <span>{{ post.likes }}</span>
                        </button>
                        <button
                          type="button"
                          (click)="focusCommentInput(post.id)"
                          class="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white transition">
                          <span class="text-lg">💬</span>
                          <span>{{ post.comments.length }}</span>
                        </button>
                        <button
                          type="button"
                          (click)="sharePostEvent(post)"
                          class="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white transition">
                          <span class="text-lg">🚀</span>
                          <span class="text-xs">Fan-out</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        (click)="toggleBookmark(post.id)"
                        class="text-sm font-medium px-2.5 py-1 rounded-lg border transition {{ post.bookmarkedByMe ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800' }}">
                        {{ post.bookmarkedByMe ? '★ Saved' : '☆ Save' }}
                      </button>
                    </div>

                    <!-- Caption -->
                    <div class="text-sm text-slate-200 leading-relaxed">
                      <span class="font-semibold text-white mr-1.5">{{ post.authorUsername }}</span>
                      <span>{{ post.caption }}</span>
                    </div>

                    <!-- Comments List -->
                    @if (post.comments.length > 0) {
                      <div class="space-y-1.5 pt-2 border-t border-slate-800/80">
                        @for (comment of post.comments; track comment.id) {
                          <div class="flex items-start justify-between gap-2 text-xs">
                            <div>
                              <span class="font-semibold text-slate-200 mr-1.5">{{ comment.authorUsername }}</span>
                              <span class="text-slate-300">{{ comment.text }}</span>
                            </div>
                            <span class="text-[10px] text-slate-500 shrink-0">{{ comment.createdAt }}</span>
                          </div>
                        }
                      </div>
                    }

                    <!-- Add Comment Input -->
                    <div class="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        [value]="getCommentDraft(post.id)"
                        (input)="onCommentInput(post.id, $event)"
                        (keydown.enter)="submitComment(post.id)"
                        placeholder="Add a comment via POST /api/v1/posts/{{ post.id }}/comments..."
                        class="flex-1 bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500" />
                      <button
                        type="button"
                        (click)="submitComment(post.id)"
                        class="px-3 py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-xs font-semibold transition">
                        Post
                      </button>
                    </div>
                  </div>
                </article>
              }
            </div>
          }

          <!-- TAB 2: EXPLORE & SEARCH -->
          @if (activeTab() === 'explore') {
            <section class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 class="text-base font-bold text-white">Explore Visual Feed</h2>
                  <p class="text-xs text-slate-400">Indexed via PostgreSQL GIN full-text search &amp; Redis popular tags</p>
                </div>
                <input
                  type="text"
                  [value]="searchQuery()"
                  (input)="onSearchInput($event)"
                  placeholder="Search captions, &#64;users, locations..."
                  class="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 w-full sm:w-64" />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                @for (post of explorePosts(); track post.id) {
                  <div class="group relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <img [src]="post.svgScene" [alt]="post.caption" class="w-full h-48 object-cover {{ post.filterClass }}" />
                    <div class="p-3 space-y-1.5">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold text-white">&#64;{{ post.authorUsername }}</span>
                        <span class="text-xs text-rose-400 font-medium">❤️ {{ post.likes }}</span>
                      </div>
                      <p class="text-xs text-slate-300 line-clamp-2">{{ post.caption }}</p>
                      <div class="flex items-center justify-between pt-1">
                        <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">{{ post.category }}</span>
                        <button
                          type="button"
                          (click)="toggleLike(post.id)"
                          class="text-xs text-pink-400 hover:text-pink-300 font-medium">
                          {{ post.likedByMe ? 'Unlike' : 'Like Post' }}
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </section>
          }

          <!-- TAB 3: DIRECT MESSAGES (KAFKA STREAMED) -->
          @if (activeTab() === 'messages') {
            <section class="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
              <div class="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 class="text-base font-bold text-white">Direct Messages</h2>
                  <p class="text-xs text-slate-400">Real-time delivery over Kafka topic <code class="text-amber-300">social.notification.fanout</code></p>
                </div>
                <div class="flex gap-1.5">
                  @for (thread of threads(); track thread.id) {
                    <button
                      type="button"
                      (click)="selectThread(thread.id)"
                      class="px-2.5 py-1 rounded-lg text-xs font-medium transition {{ activeThreadId() === thread.id ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700' }}">
                      &#64;{{ thread.username }}
                    </button>
                  }
                </div>
              </div>

              @if (activeThread(); as thread) {
                <div class="p-4 space-y-4">
                  <div class="flex items-center gap-3 pb-3 border-b border-slate-800">
                    <img [src]="thread.avatar" [alt]="thread.username" class="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p class="text-sm font-semibold text-white">{{ thread.displayName }}</p>
                      <p class="text-xs text-emerald-400">{{ thread.status }}</p>
                    </div>
                  </div>

                  <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
                    @for (msg of thread.messages; track msg.id) {
                      <div class="flex {{ msg.fromMe ? 'justify-end' : 'justify-start' }}">
                        <div class="max-w-xs sm:max-w-md px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed {{ msg.fromMe ? 'bg-gradient-to-r from-pink-500 to-indigo-600 text-white' : 'bg-slate-800 text-slate-200' }}">
                          <p>{{ msg.text }}</p>
                          <p class="text-[10px] opacity-75 mt-1 text-right">{{ msg.time }}</p>
                        </div>
                      </div>
                    }
                  </div>

                  <div class="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <input
                      type="text"
                      [value]="dmDraft()"
                      (input)="onDmInput($event)"
                      (keydown.enter)="sendDirectMessage()"
                      placeholder="Write a message via Kafka event stream..."
                      class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500" />
                    <button
                      type="button"
                      (click)="sendDirectMessage()"
                      class="px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold transition">
                      Send
                    </button>
                  </div>
                </div>
              }
            </section>
          }

          <!-- TAB 4: USER PROFILE & SAVED BOOKMARKS -->
          @if (activeTab() === 'profile') {
            <section class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div class="flex items-center gap-4">
                  <div class="p-1 rounded-full story-ring">
                    <img [src]="currentUser().avatar" alt="Profile" class="w-16 h-16 rounded-full object-cover border-2 border-slate-950" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h2 class="text-lg font-bold text-white">{{ currentUser().displayName }}</h2>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {{ currentUser().provider }}
                      </span>
                    </div>
                    <p class="text-xs text-slate-400">&#64;{{ currentUser().username }} · {{ currentUser().email }}</p>
                    <p class="text-xs text-slate-200 mt-1.5">{{ currentUser().bio }}</p>
                  </div>
                </div>

                <div class="flex gap-4 text-center bg-slate-950/70 px-4 py-2.5 rounded-xl border border-slate-800">
                  <div>
                    <p class="text-sm font-bold text-white">{{ myPosts().length }}</p>
                    <p class="text-[11px] text-slate-400">Posts</p>
                  </div>
                  <div>
                    <p class="text-sm font-bold text-white">{{ currentUser().followers }}</p>
                    <p class="text-[11px] text-slate-400">Followers</p>
                  </div>
                  <div>
                    <p class="text-sm font-bold text-white">{{ currentUser().following }}</p>
                    <p class="text-[11px] text-slate-400">Following</p>
                  </div>
                </div>
              </div>

              <!-- Sub-tabs: My Posts vs Bookmarked -->
              <div class="flex items-center justify-between">
                <div class="flex gap-2">
                  <button
                    type="button"
                    (click)="setProfileView('posts')"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold transition {{ profileView() === 'posts' ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-300' }}">
                    My Published Posts ({{ myPosts().length }})
                  </button>
                  <button
                    type="button"
                    (click)="setProfileView('saved')"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold transition {{ profileView() === 'saved' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300' }}">
                    ★ Saved Bookmarks ({{ savedPosts().length }})
                  </button>
                </div>
                <button
                  type="button"
                  (click)="openCreateModal()"
                  class="text-xs text-pink-400 hover:text-pink-300 font-semibold">
                  + Publish New Post
                </button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                @for (post of profileDisplayedPosts(); track post.id) {
                  <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <img [src]="post.svgScene" [alt]="post.caption" class="w-full h-44 object-cover {{ post.filterClass }}" />
                    <div class="p-3 space-y-1">
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-semibold text-white">&#64;{{ post.authorUsername }}</span>
                        <span class="text-rose-400">❤️ {{ post.likes }} · 💬 {{ post.comments.length }}</span>
                      </div>
                      <p class="text-xs text-slate-300 line-clamp-2">{{ post.caption }}</p>
                    </div>
                  </div>
                }
              </div>
            </section>
          }

          <!-- TAB 5: OAUTH2 & SPRING SECURITY CONSOLE -->
          @if (activeTab() === 'oauth') {
            <section class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div class="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 class="text-base font-bold text-white">Spring Security 6 OAuth2 / OIDC Authentication Console</h2>
                  <p class="text-xs text-slate-400">Switch OAuth2 identity providers, inspect decoded RS256 JWT claims, and test Redis rate limiting</p>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                  Stateless Bearer JWT
                </span>
              </div>

              <!-- Provider Switcher -->
              <div class="space-y-2">
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">1. Simulate OAuth2 Authorization Code + PKCE Login</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    (click)="switchOAuthProvider('Keycloak OIDC')"
                    class="p-3 rounded-xl border text-left transition {{ currentUser().provider === 'Keycloak OIDC' ? 'bg-indigo-600/25 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60' }}">
                    <p class="text-xs font-bold">Keycloak OIDC Realm</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Self-hosted Spring Boot IDP</p>
                  </button>
                  <button
                    type="button"
                    (click)="switchOAuthProvider('Google OAuth2')"
                    class="p-3 rounded-xl border text-left transition {{ currentUser().provider === 'Google OAuth2' ? 'bg-indigo-600/25 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60' }}">
                    <p class="text-xs font-bold">Google OAuth2</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">accounts.google.com JWK</p>
                  </button>
                  <button
                    type="button"
                    (click)="switchOAuthProvider('GitHub OAuth2')"
                    class="p-3 rounded-xl border text-left transition {{ currentUser().provider === 'GitHub OAuth2' ? 'bg-indigo-600/25 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60' }}">
                    <p class="text-xs font-bold">GitHub OAuth2</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">OAuth2 Client Registration</p>
                  </button>
                </div>
              </div>

              <!-- Decoded JWT Claims -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">2. Decoded Access Token Payload (Validated by JwtAuthenticationConverter)</p>
                  <button
                    type="button"
                    (click)="rotateJwtToken()"
                    class="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                    ↻ Refresh Token (PKCE)
                  </button>
                </div>
                <pre class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11px] text-emerald-300 font-mono overflow-x-auto leading-relaxed">{{ decodedJwtPayload() }}</pre>
              </div>

              <!-- Redis Sliding-Window Rate Limiter Test -->
              <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-semibold text-white">3. Redis Sliding-Window Rate Limiter (RedisRateLimitingFilter.java)</p>
                  <p class="text-xs text-slate-400">Current window usage: <strong class="text-rose-400">{{ rateLimitUsed() }} / 100</strong> requests per minute (INCR rl:ip:127.0.0.1)</p>
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    (click)="simulateBurstTraffic()"
                    class="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition">
                    Simulate +15 API Burst
                  </button>
                  <button
                    type="button"
                    (click)="resetRateLimiter()"
                    class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition">
                    Reset Window
                  </button>
                </div>
              </div>
            </section>
          }

          <!-- TAB 6: BACKEND TELEMETRY & SOURCE CODE INSPECTOR -->
          @if (activeTab() === 'architecture') {
            <section class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
                <div>
                  <h2 class="text-base font-bold text-white">Spring Boot + Redis + Kafka + PostgreSQL Live Inspector</h2>
                  <p class="text-xs text-slate-400">Every UI interaction updates Redis keys, emits Kafka events, and persists to PostgreSQL</p>
                </div>
                <div class="flex gap-1.5">
                  <button
                    type="button"
                    (click)="setBackendSubTab('telemetry')"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold transition {{ backendSubTab() === 'telemetry' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300' }}">
                    Live Telemetry
                  </button>
                  <button
                    type="button"
                    (click)="setBackendSubTab('code')"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold transition {{ backendSubTab() === 'code' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300' }}">
                    Backend Java / SQL Source
                  </button>
                </div>
              </div>

              @if (backendSubTab() === 'telemetry') {
                <!-- Redis Cache Inspector -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-rose-400">Redis 7 Keyspace (localhost:6379)</h3>
                    <button
                      type="button"
                      (click)="flushRedisCache()"
                      class="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition">
                      FLUSHDB (Evict Cache)
                    </button>
                  </div>
                  <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <table class="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr class="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                          <th class="py-2 px-3">Redis Key</th>
                          <th class="py-2 px-3">Type</th>
                          <th class="py-2 px-3">TTL</th>
                          <th class="py-2 px-3">Value Preview</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-800/70 font-mono text-[11px]">
                        @for (entry of redisEntries(); track entry.key) {
                          <tr>
                            <td class="py-2 px-3 text-rose-300">{{ entry.key }}</td>
                            <td class="py-2 px-3 text-slate-400">{{ entry.type }}</td>
                            <td class="py-2 px-3 text-emerald-400">{{ entry.ttlSeconds }}s</td>
                            <td class="py-2 px-3 text-slate-300 truncate max-w-[180px]">{{ entry.valuePreview }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Apache Kafka Stream Log -->
                <div class="space-y-2">
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-amber-400">Apache Kafka Event Stream (Group: instaflux-social-group)</h3>
                  <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                    @for (ev of kafkaEvents(); track ev.id) {
                      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono">
                        <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span class="text-amber-300 font-semibold">{{ ev.topic }} [partition={{ ev.partition }}, offset={{ ev.offset }}]</span>
                          <span>{{ ev.timestamp }}</span>
                        </div>
                        <p class="text-slate-200">Key: <span class="text-sky-300">{{ ev.key }}</span> · Type: <span class="text-emerald-300">{{ ev.eventType }}</span></p>
                        <p class="text-slate-400 text-[11px] mt-0.5">{{ ev.payload }}</p>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (backendSubTab() === 'code') {
                <div class="space-y-3">
                  <div class="flex flex-wrap gap-1.5">
                    @for (snippet of backendCodeFiles; track snippet.name) {
                      <button
                        type="button"
                        (click)="selectCodeFile(snippet.name)"
                        class="px-2.5 py-1 rounded-lg text-xs font-mono transition {{ selectedCodeFileName() === snippet.name ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-300 border border-slate-800' }}">
                        {{ snippet.name }}
                      </button>
                    }
                  </div>
                  <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] text-slate-200 font-mono overflow-x-auto max-h-96 leading-relaxed">{{ activeCodeSnippet() }}</pre>
                </div>
              }
            </section>
          }
        </main>

        <!-- Right Sidebar: Live Spring Boot API Trace & Suggested Creators -->
        <aside class="lg:col-span-3 space-y-5">
          <!-- Suggested Creators to Follow -->
          <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Suggested Creators</h3>
              <span class="text-[11px] text-slate-500">Graph DB</span>
            </div>
            <div class="space-y-3">
              @for (creator of suggestedUsers(); track creator.id) {
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <img [src]="creator.avatar" [alt]="creator.username" class="w-9 h-9 rounded-full object-cover border border-slate-700" />
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-white truncate">{{ creator.displayName }}</p>
                      <p class="text-[11px] text-slate-400 truncate">&#64;{{ creator.username }} · {{ creator.followers }} flw</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    (click)="toggleFollowUser(creator.id)"
                    class="px-2.5 py-1 rounded-lg text-xs font-semibold transition {{ creator.isFollowedByMe ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-pink-500 hover:bg-pink-600 text-white' }}">
                    {{ creator.isFollowedByMe ? 'Following' : 'Follow' }}
                  </button>
                </div>
              }
            </div>
          </div>

          <!-- Live Spring Boot REST & Kafka Activity Log -->
          <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-emerald-400">Spring Boot API Trace</h3>
              <span class="text-[10px] font-mono text-slate-400">:8080/api/v1</span>
            </div>
            <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
              @for (trace of apiTraces(); track trace.id) {
                <div class="bg-slate-950/90 border border-slate-800/90 rounded-xl p-2.5 text-[11px] font-mono space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">{{ trace.method }}</span>
                    <span class="text-emerald-400">{{ trace.status }} OK ({{ trace.latencyMs }}ms)</span>
                  </div>
                  <p class="text-slate-200 truncate">{{ trace.endpoint }}</p>
                  <div class="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{{ trace.cacheOutcome }}</span>
                    <span>{{ trace.timestamp }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        </aside>
      </div>

      <!-- MODAL 1: CREATE NEW POST -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 class="text-base font-bold text-white">Create New Post</h3>
                <p class="text-xs text-slate-400">Publishes via Spring Boot -> PostgreSQL -> Kafka -> Redis</p>
              </div>
              <button
                type="button"
                (click)="closeCreateModal()"
                class="text-slate-400 hover:text-white text-sm font-bold px-2">
                ✕
              </button>
            </div>

            <!-- Artwork Preset Picker -->
            <div class="space-y-2">
              <label class="text-xs font-semibold text-slate-300">Select Visual Scene</label>
              <div class="grid grid-cols-3 gap-2">
                @for (scene of scenePresets; track scene.label; let idx = $index) {
                  <button
                    type="button"
                    (click)="selectScenePreset(idx)"
                    class="p-1.5 rounded-xl border text-left transition {{ newPostSceneIndex() === idx ? 'border-pink-500 bg-pink-500/10' : 'border-slate-800 bg-slate-950' }}">
                    <img [src]="scene.svg" [alt]="scene.label" class="w-full h-16 object-cover rounded-lg mb-1" />
                    <p class="text-[11px] font-medium text-slate-200 truncate">{{ scene.label }}</p>
                  </button>
                }
              </div>
            </div>

            <!-- Filter Picker -->
            <div class="space-y-2">
              <label class="text-xs font-semibold text-slate-300">Apply Visual Filter</label>
              <div class="flex flex-wrap gap-1.5">
                @for (flt of filterOptions; track flt.label) {
                  <button
                    type="button"
                    (click)="selectFilterOption(flt)"
                    class="px-2.5 py-1 rounded-lg text-xs font-medium transition {{ newPostFilter().label === flt.label ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-300' }}">
                    {{ flt.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Caption & Location -->
            <div class="space-y-3">
              <div>
                <label class="text-xs font-semibold text-slate-300 block mb-1">Caption &amp; Hashtags</label>
                <textarea
                  rows="3"
                  [value]="newPostCaption()"
                  (input)="onNewCaptionInput($event)"
                  placeholder="Share what you're building... #springboot #angular #kafka"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"></textarea>
              </div>
              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="text-xs font-semibold text-slate-300 block mb-1">Location</label>
                  <input
                    type="text"
                    [value]="newPostLocation()"
                    (input)="onNewLocationInput($event)"
                    placeholder="Kolkata, India"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label class="text-xs font-semibold text-slate-300 block mb-1">Category</label>
                  <select
                    [value]="newPostCategory()"
                    (change)="onNewCategoryChange($event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500">
                    <option value="Cyberpunk">Cyberpunk</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Nature">Nature</option>
                    <option value="Portrait">Portrait</option>
                    <option value="Code & Tech">Code &amp; Tech</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                (click)="closeCreateModal()"
                class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium">
                Cancel
              </button>
              <button
                type="button"
                (click)="publishNewPost()"
                class="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-amber-500 text-white text-xs font-semibold shadow-lg">
                Publish Post (POST /api/v1/posts)
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 2: STORY VIEWER -->
      @if (activeStory(); as st) {
        <div class="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div class="relative max-w-sm w-full rounded-3xl overflow-hidden border border-slate-700 shadow-2xl {{ st.gradient }} p-6 flex flex-col justify-between min-h-[420px]">
            <div>
              <div class="w-full bg-white/25 h-1 rounded-full overflow-hidden mb-4">
                <div class="bg-white h-full w-full"></div>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <img [src]="st.avatar" [alt]="st.username" class="w-10 h-10 rounded-full object-cover border-2 border-white" />
                  <div>
                    <p class="text-sm font-bold text-white">{{ st.displayName }}</p>
                    <p class="text-[11px] text-white/80">&#64;{{ st.username }} · {{ st.createdAt }}</p>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="closeStory()"
                  class="w-8 h-8 rounded-full bg-black/30 text-white text-sm font-bold flex items-center justify-center">
                  ✕
                </button>
              </div>
            </div>

            <div class="my-auto py-10 text-center space-y-2">
              <p class="text-2xl font-extrabold text-white tracking-tight drop-shadow">{{ st.title }}</p>
              <p class="text-sm text-white/90">{{ st.subtitle }}</p>
            </div>

            <div class="flex items-center justify-between text-xs text-white/80 border-t border-white/20 pt-3">
              <span>Cached in Redis (story:ttl:24h)</span>
              <button
                type="button"
                (click)="closeStory()"
                class="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold">
                Close Story
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class App {
  readonly categories = ['All', 'Cyberpunk', 'Architecture', 'Nature', 'Portrait', 'Code & Tech'] as const;

  readonly filterOptions = [
    { label: 'Normal', css: 'filter-normal' },
    { label: 'Vivid Pop', css: 'filter-vivid' },
    { label: 'Cyber Glow', css: 'filter-cyber' },
    { label: 'Warm Sunset', css: 'filter-warm' },
    { label: 'Cinema Noir', css: 'filter-noir' }
  ];

  readonly scenePresets = [
    {
      label: 'Neon Skyline',
      svg: this.buildSceneDataUri('#0f172a', '#ec4899', '#6366f1', 'NEON METROPOLIS 2026', 'Spring Boot + Kafka Stream')
    },
    {
      label: 'Himalayan Dawn',
      svg: this.buildSceneDataUri('#1e1b4b', '#f59e0b', '#10b981', 'GOLDEN RIDGE EXPEDITION', 'PostgreSQL Geo-Tagged')
    },
    {
      label: 'Architecture Studio',
      svg: this.buildSceneDataUri('#090d16', '#38bdf8', '#a855f7', 'MINIMALIST PAVILION', 'OAuth2 Verified Creator')
    }
  ];

  readonly backendCodeFiles = [
    {
      name: 'SecurityConfig.java',
      code: `@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {
  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
      .csrf(csrf -> csrf.disable())
      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers("/actuator/health", "/api/v1/auth/**").permitAll()
        .requestMatchers(HttpMethod.POST, "/api/v1/posts/**").hasAuthority("SCOPE_write:posts")
        .anyRequest().authenticated()
      )
      .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
      .addFilterBefore(redisRateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
      .build();
  }
}`
    },
    {
      name: 'PostController.java',
      code: `@RestController
@RequestMapping("/api/v1/posts")
public class PostController {
  private final RedisFeedCacheService redisCache;
  private final KafkaSocialEventBus kafkaBus;

  @PostMapping("/{postId}/likes")
  public ResponseEntity<Map<String, Object>> toggleLike(
      @AuthenticationPrincipal Jwt jwt, @PathVariable UUID postId) {
    String user = jwt.getClaimAsString("preferred_username");
    Long likes = redisCache.incrementPostLikes(postId, 1L);
    kafkaBus.publishEvent("social.interaction.liked",
      new SocialEvent(UUID.randomUUID().toString(), "POST_LIKED", user, postId));
    return ResponseEntity.ok(Map.of("postId", postId, "likes", likes));
  }
}`
    },
    {
      name: 'V1__init_schema.sql',
      code: `CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  oauth_sub VARCHAR(128) NOT NULL UNIQUE,
  username VARCHAR(40) NOT NULL UNIQUE,
  display_name VARCHAR(80) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  media_url TEXT NOT NULL,
  like_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`
    }
  ];

  readonly activeTab = signal<'feed' | 'explore' | 'messages' | 'profile' | 'oauth' | 'architecture'>('feed');
  readonly backendSubTab = signal<'telemetry' | 'code'>('telemetry');
  readonly selectedCodeFileName = signal<string>('SecurityConfig.java');
  readonly selectedCategory = signal<string>('All');
  readonly searchQuery = signal<string>('');
  readonly profileView = signal<'posts' | 'saved'>('posts');
  readonly toastMessage = signal<string>('');

  readonly showCreateModal = signal<boolean>(false);
  readonly newPostSceneIndex = signal<number>(0);
  readonly newPostFilter = signal<{ label: string; css: string }>({ label: 'Normal', css: 'filter-normal' });
  readonly newPostCaption = signal<string>('');
  readonly newPostLocation = signal<string>('Kolkata, India');
  readonly newPostCategory = signal<'Architecture' | 'Cyberpunk' | 'Nature' | 'Portrait' | 'Code & Tech'>('Cyberpunk');

  readonly activeStory = signal<StoryItem | null>(null);
  readonly commentDrafts = signal<Record<string, string>>({});

  readonly currentUser = signal<UserProfile>({
    id: 'u-101',
    oauthSub: 'f9b2c1d0-8e34-4c5a-9b11-0029a8f19c2a',
    provider: 'Keycloak OIDC',
    username: 'arjun_dev',
    displayName: 'Arjun Mukherjee',
    email: 'arjun@instaflux.dev',
    bio: 'Full-Stack Architect · Java 21 Spring Boot + Angular 18 + Kafka + Redis + OAuth2',
    avatar: this.buildAvatarDataUri('AM', '#ec4899', '#6366f1'),
    verified: true,
    followers: 1480,
    following: 312
  });

  readonly jwtNonce = signal<string>('jti-98f1a2b4c6');
  readonly rateLimitUsed = signal<number>(14);
  readonly redisHits = signal<number>(47);
  readonly redisMisses = signal<number>(3);

  readonly stories = signal<StoryItem[]>([
    {
      id: 'st-1',
      username: 'arjun_dev',
      displayName: 'Arjun Mukherjee',
      avatar: this.buildAvatarDataUri('AM', '#ec4899', '#6366f1'),
      title: 'Spring Boot 3.3 + Kafka Cluster Live!',
      subtitle: 'Zero-downtime OAuth2 PKCE + Redis timeline caching deployed.',
      gradient: 'bg-gradient-to-br from-pink-600 via-purple-700 to-indigo-900',
      viewed: false,
      createdAt: '12m ago'
    },
    {
      id: 'st-2',
      username: 'priya_cloud',
      displayName: 'Priya Sen',
      avatar: this.buildAvatarDataUri('PS', '#f59e0b', '#ef4444'),
      title: 'PostgreSQL 16 Partitioned Tables',
      subtitle: 'Sub-8ms timeline queries with Redis read-through cache.',
      gradient: 'bg-gradient-to-br from-amber-500 via-rose-600 to-slate-900',
      viewed: false,
      createdAt: '38m ago'
    },
    {
      id: 'st-3',
      username: 'rohan_sec',
      displayName: 'Rohan Das',
      avatar: this.buildAvatarDataUri('RD', '#10b981', '#0ea5e9'),
      title: 'OAuth2 RS256 JWK Rotation',
      subtitle: 'Keycloak OIDC + Google OAuth2 bearer validation active.',
      gradient: 'bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-950',
      viewed: false,
      createdAt: '1h ago'
    }
  ]);

  readonly posts = signal<PostItem[]>([
    {
      id: 'p-101',
      authorId: 'u-101',
      authorUsername: 'arjun_dev',
      authorDisplayName: 'Arjun Mukherjee',
      authorAvatar: this.buildAvatarDataUri('AM', '#ec4899', '#6366f1'),
      authorVerified: true,
      location: 'Baranagar, Kolkata',
      caption: 'Shipped our reactive social feed powered by Java 21 Spring Boot, PostgreSQL 16, Redis timeline caching, and Apache Kafka event fan-out! #springboot #angular #kafka #oauth2',
      category: 'Code & Tech',
      filterClass: 'filter-normal',
      filterLabel: 'Normal',
      svgScene: this.buildSceneDataUri('#0f172a', '#ec4899', '#6366f1', 'SPRING BOOT 3 + KAFKA', 'Sub-10ms Redis Cached Timeline'),
      likes: 284,
      likedByMe: true,
      bookmarkedByMe: true,
      createdAt: '18 mins ago',
      comments: [
        {
          id: 'c-1',
          authorUsername: 'priya_cloud',
          authorAvatar: this.buildAvatarDataUri('PS', '#f59e0b', '#ef4444'),
          text: 'The Redis HINCRBY counter + Kafka consumer architecture is super clean!',
          createdAt: '14m ago'
        },
        {
          id: 'c-2',
          authorUsername: 'rohan_sec',
          authorAvatar: this.buildAvatarDataUri('RD', '#10b981', '#0ea5e9'),
          text: 'Tested the OAuth2 PKCE flow with Keycloak — works like a charm.',
          createdAt: '6m ago'
        }
      ]
    },
    {
      id: 'p-102',
      authorId: 'u-102',
      authorUsername: 'priya_cloud',
      authorDisplayName: 'Priya Sen',
      authorAvatar: this.buildAvatarDataUri('PS', '#f59e0b', '#ef4444'),
      authorVerified: true,
      location: 'Salt Lake Sector V',
      caption: 'Evening reflections over the glass skybridge after optimizing our PostgreSQL composite indexes. #architecture #postgres #cloudnative',
      category: 'Architecture',
      filterClass: 'filter-vivid',
      filterLabel: 'Vivid Pop',
      svgScene: this.buildSceneDataUri('#1e1b4b', '#f59e0b', '#ec4899', 'SKYBRIDGE TWILIGHT', 'Salt Lake Tech Corridor'),
      likes: 192,
      likedByMe: false,
      bookmarkedByMe: false,
      createdAt: '1 hour ago',
      comments: [
        {
          id: 'c-3',
          authorUsername: 'arjun_dev',
          authorAvatar: this.buildAvatarDataUri('AM', '#ec4899', '#6366f1'),
          text: 'Awesome color grading on this shot!',
          createdAt: '42m ago'
        }
      ]
    },
    {
      id: 'p-103',
      authorId: 'u-103',
      authorUsername: 'rohan_sec',
      authorDisplayName: 'Rohan Das',
      authorAvatar: this.buildAvatarDataUri('RD', '#10b981', '#0ea5e9'),
      authorVerified: true,
      location: 'Bengaluru Cyber Park',
      caption: 'Zero-trust API security checklist: OAuth2 Resource Server + RS256 JWT + Redis sliding-window rate limiting + strict CORS headers. #cybersecurity #oauth2 #java',
      category: 'Cyberpunk',
      filterClass: 'filter-cyber',
      filterLabel: 'Cyber Glow',
      svgScene: this.buildSceneDataUri('#042f2e', '#10b981', '#38bdf8', 'ZERO-TRUST OAUTH2 MESH', 'RS256 JWT + Redis Rate Limiter'),
      likes: 341,
      likedByMe: false,
      bookmarkedByMe: true,
      createdAt: '3 hours ago',
      comments: []
    }
  ]);

  readonly suggestedUsers = signal<UserProfile[]>([
    {
      id: 'u-201',
      oauthSub: 'sub-201',
      provider: 'Google OAuth2',
      username: 'ananya_ui',
      displayName: 'Ananya Roy',
      email: 'ananya@design.io',
      bio: 'Angular Signals & Design Systems',
      avatar: this.buildAvatarDataUri('AR', '#a855f7', '#ec4899'),
      verified: true,
      followers: 2890,
      following: 410,
      isFollowedByMe: false
    },
    {
      id: 'u-202',
      oauthSub: 'sub-202',
      provider: 'GitHub OAuth2',
      username: 'vikram_kafka',
      displayName: 'Vikramjit Bose',
      email: 'vikram@streams.dev',
      bio: 'Distributed Systems · Kafka & Redis',
      avatar: this.buildAvatarDataUri('VB', '#0ea5e9', '#6366f1'),
      verified: true,
      followers: 1920,
      following: 205,
      isFollowedByMe: true
    }
  ]);

  readonly threads = signal<ChatThread[]>([
    {
      id: 'th-1',
      username: 'priya_cloud',
      displayName: 'Priya Sen',
      avatar: this.buildAvatarDataUri('PS', '#f59e0b', '#ef4444'),
      status: 'Online · Connected via Kafka WebSocket Bridge',
      messages: [
        { id: 'm-1', sender: 'priya_cloud', text: 'Hey Arjun! Did the Flyway V1__init_schema.sql migration finish on PostgreSQL?', time: '11:42 AM', fromMe: false },
        { id: 'm-2', sender: 'arjun_dev', text: 'Yes! All 6 tables and composite indexes are live, and Redis caching is serving the feed.', time: '11:45 AM', fromMe: true }
      ]
    },
    {
      id: 'th-2',
      username: 'rohan_sec',
      displayName: 'Rohan Das',
      avatar: this.buildAvatarDataUri('RD', '#10b981', '#0ea5e9'),
      status: 'Online · OAuth2 Scope: write:messages',
      messages: [
        { id: 'm-3', sender: 'rohan_sec', text: 'Keycloak realm instaflux is issuing RS256 access tokens with 15m TTL.', time: '11:50 AM', fromMe: false }
      ]
    }
  ]);

  readonly activeThreadId = signal<string>('th-1');
  readonly dmDraft = signal<string>('');

  readonly kafkaEvents = signal<KafkaEventLog[]>([
    {
      id: 'kev-3',
      topic: 'social.interaction.liked',
      partition: 0,
      offset: 1042,
      key: 'arjun_dev',
      eventType: 'POST_LIKED',
      payload: '{"postId":"p-101","actor":"arjun_dev","redisMetric":"post:metrics:p-101"}',
      timestamp: '11:51:10'
    },
    {
      id: 'kev-2',
      topic: 'social.post.created',
      partition: 1,
      offset: 889,
      key: 'arjun_dev',
      eventType: 'POST_CREATED',
      payload: '{"postId":"p-101","author":"arjun_dev","fanoutTargets":1480}',
      timestamp: '11:48:02'
    },
    {
      id: 'kev-1',
      topic: 'social.auth.audit',
      partition: 0,
      offset: 412,
      key: 'arjun_dev',
      eventType: 'OAUTH2_TOKEN_ISSUED',
      payload: '{"provider":"Keycloak OIDC","alg":"RS256","scope":"read:feed write:posts write:likes"}',
      timestamp: '11:45:00'
    }
  ]);

  readonly redisEntries = signal<RedisCacheEntry[]>([
    {
      key: 'feed:timeline:arjun_dev',
      type: 'STRING (JSON)',
      ttlSeconds: 288,
      valuePreview: '[{"id":"p-101","likes":284},{"id":"p-102","likes":192} ...]',
      lastUpdated: 'Just now'
    },
    {
      key: 'post:metrics:p-101',
      type: 'HASH (Counters)',
      ttlSeconds: 86400,
      valuePreview: 'likes=284, comments=2, bookmarks=1',
      lastUpdated: '1m ago'
    },
    {
      key: 'rl:ip:127.0.0.1',
      type: 'COUNTER (RateLimit)',
      ttlSeconds: 54,
      valuePreview: '14 / 100 req/min',
      lastUpdated: 'Just now'
    }
  ]);

  readonly apiTraces = signal<ApiTraceLog[]>([
    {
      id: 'tr-1',
      method: 'GET',
      endpoint: '/api/v1/posts/feed',
      status: 200,
      latencyMs: 6,
      cacheOutcome: 'REDIS_HIT',
      timestamp: '11:52:01'
    },
    {
      id: 'tr-2',
      method: 'POST',
      endpoint: '/api/v1/posts/p-101/likes',
      status: 200,
      latencyMs: 12,
      cacheOutcome: 'REDIS_WRITE + KAFKA_PUB',
      timestamp: '11:51:10'
    }
  ]);

  readonly redisHitRate = computed(() => {
    const total = this.redisHits() + this.redisMisses();
    return total === 0 ? 100 : Math.round((this.redisHits() / total) * 100);
  });

  readonly totalCommentsCount = computed(() =>
    this.posts().reduce((acc, p) => acc + p.comments.length, 0)
  );

  readonly filteredPosts = computed(() => {
    const cat = this.selectedCategory();
    if (cat === 'All') {
      return this.posts();
    }
    return this.posts().filter(p => p.category === cat);
  });

  readonly explorePosts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return this.posts();
    }
    return this.posts().filter(
      p =>
        p.caption.toLowerCase().includes(q) ||
        p.authorUsername.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  });

  readonly myPosts = computed(() =>
    this.posts().filter(p => p.authorUsername === this.currentUser().username)
  );

  readonly savedPosts = computed(() =>
    this.posts().filter(p => p.bookmarkedByMe)
  );

  readonly profileDisplayedPosts = computed(() =>
    this.profileView() === 'posts' ? this.myPosts() : this.savedPosts()
  );

  readonly activeThread = computed(() =>
    this.threads().find(t => t.id === this.activeThreadId()) ?? this.threads()[0]
  );

  readonly activeCodeSnippet = computed(() => {
    const found = this.backendCodeFiles.find(f => f.name === this.selectedCodeFileName());
    return found ? found.code : '';
  });

  readonly decodedJwtPayload = computed(() => {
    const u = this.currentUser();
    return JSON.stringify(
      {
        iss: u.provider === 'Keycloak OIDC'
          ? 'http://localhost:8180/realms/instaflux'
          : u.provider === 'Google OAuth2'
          ? 'https://accounts.google.com'
          : 'https://github.com/login/oauth',
        sub: u.oauthSub,
        preferred_username: u.username,
        email: u.email,
        scope: 'openid profile email read:feed write:posts write:likes write:messages',
        authorities: ['SCOPE_read:feed', 'SCOPE_write:posts', 'SCOPE_write:likes', 'ROLE_USER'],
        jti: this.jwtNonce(),
        alg: 'RS256'
      },
      null,
      2
    );
  });

  private buildAvatarDataUri(initials: string, c1: string, c2: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill="url(#g)"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Inter, sans-serif" font-weight="700" font-size="42">${initials}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  private buildSceneDataUri(bg: string, accent1: string, accent2: string, title: string, subtitle: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg}"/>
          <stop offset="55%" stop-color="${accent2}"/>
          <stop offset="100%" stop-color="${accent1}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg)"/>
      <circle cx="650" cy="140" r="110" fill="${accent1}" opacity="0.35"/>
      <circle cx="180" cy="470" r="160" fill="${accent2}" opacity="0.28"/>
      <path d="M0 460 L220 320 L410 430 L610 270 L800 390 L800 600 L0 600 Z" fill="#090d16" opacity="0.55"/>
      <rect x="60" y="60" width="680" height="480" rx="24" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
      <text x="100" y="290" fill="#ffffff" font-family="Inter, sans-serif" font-weight="800" font-size="38" letter-spacing="1">${title}</text>
      <text x="100" y="338" fill="#e2e8f0" font-family="Inter, sans-serif" font-weight="500" font-size="22">${subtitle}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  setActiveTab(tab: 'feed' | 'explore' | 'messages' | 'profile' | 'oauth' | 'architecture'): void {
    this.activeTab.set(tab);
  }

  setBackendSubTab(sub: 'telemetry' | 'code'): void {
    this.backendSubTab.set(sub);
  }

  selectCodeFile(name: string): void {
    this.selectedCodeFileName.set(name);
  }

  setSelectedCategory(cat: string): void {
    this.selectedCategory.set(cat);
    this.recordTelemetry('GET', `/api/v1/posts/feed?category=${encodeURIComponent(cat)}`, 7, 'REDIS_HIT');
  }

  setProfileView(view: 'posts' | 'saved'): void {
    this.profileView.set(view);
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  refreshFeedFromBackend(): void {
    this.redisHits.update(v => v + 1);
    this.recordTelemetry('GET', '/api/v1/posts/feed', 5, 'REDIS_HIT');
    this.showToast('Feed synchronized from Redis cache (key: feed:timeline:' + this.currentUser().username + ') in 5ms.');
  }

  toggleLike(postId: string): void {
    let updatedLikes = 0;
    let isLiked = false;
    this.posts.update(list =>
      list.map(p => {
        if (p.id !== postId) return p;
        isLiked = !p.likedByMe;
        updatedLikes = isLiked ? p.likes + 1 : Math.max(0, p.likes - 1);
        return { ...p, likedByMe: isLiked, likes: updatedLikes };
      })
    );

    this.recordTelemetry('POST', `/api/v1/posts/${postId}/likes`, 11, 'REDIS_WRITE + KAFKA_PUB');
    this.pushKafkaEvent(
      'social.interaction.liked',
      this.currentUser().username,
      isLiked ? 'POST_LIKED' : 'POST_UNLIKED',
      `{"postId":"${postId}","likes":${updatedLikes},"redisOp":"HINCRBY post:metrics:${postId}"}`
    );
    this.updateRedisEntry(`post:metrics:${postId}`, 'HASH (Counters)', 86400, `likes=${updatedLikes}`);
  }

  toggleBookmark(postId: string): void {
    this.posts.update(list =>
      list.map(p => (p.id === postId ? { ...p, bookmarkedByMe: !p.bookmarkedByMe } : p))
    );
    this.recordTelemetry('POST', `/api/v1/posts/${postId}/bookmark`, 9, 'REDIS_WRITE + KAFKA_PUB');
    this.showToast('Saved state persisted to PostgreSQL & Redis user bookmark set.');
  }

  sharePostEvent(post: PostItem): void {
    this.pushKafkaEvent(
      'social.notification.fanout',
      this.currentUser().username,
      'POST_SHARED_FANOUT',
      `{"postId":"${post.id}","author":"${post.authorUsername}","fanoutSubscribers":${this.currentUser().followers}}`
    );
    this.recordTelemetry('POST', `/api/v1/posts/${post.id}/share`, 14, 'REDIS_WRITE + KAFKA_PUB');
    this.showToast(`Published fan-out event to Kafka topic social.notification.fanout for @${post.authorUsername}'s post.`);
  }

  getCommentDraft(postId: string): string {
    return this.commentDrafts()[postId] ?? '';
  }

  onCommentInput(postId: string, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.commentDrafts.update(map => ({ ...map, [postId]: val }));
  }

  focusCommentInput(postId: string): void {
    const existing = this.getCommentDraft(postId);
    if (!existing) {
      this.commentDrafts.update(map => ({ ...map, [postId]: 'Awesome post! 🔥' }));
    }
  }

  submitComment(postId: string): void {
    const text = (this.commentDrafts()[postId] ?? '').trim();
    if (!text) return;

    const newComment: CommentItem = {
      id: 'c-' + Date.now(),
      authorUsername: this.currentUser().username,
      authorAvatar: this.currentUser().avatar,
      text,
      createdAt: 'Just now'
    };

    this.posts.update(list =>
      list.map(p => (p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p))
    );
    this.commentDrafts.update(map => ({ ...map, [postId]: '' }));

    this.recordTelemetry('POST', `/api/v1/posts/${postId}/comments`, 15, 'REDIS_WRITE + KAFKA_PUB');
    this.pushKafkaEvent(
      'social.notification.fanout',
      this.currentUser().username,
      'COMMENT_CREATED',
      `{"postId":"${postId}","commentAuthor":"${this.currentUser().username}"}`
    );
  }

  openCreateModal(): void {
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  selectScenePreset(index: number): void {
    this.newPostSceneIndex.set(index);
  }

  selectFilterOption(flt: { label: string; css: string }): void {
    this.newPostFilter.set(flt);
  }

  onNewCaptionInput(event: Event): void {
    this.newPostCaption.set((event.target as HTMLTextAreaElement).value);
  }

  onNewLocationInput(event: Event): void {
    this.newPostLocation.set((event.target as HTMLInputElement).value);
  }

  onNewCategoryChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as 'Architecture' | 'Cyberpunk' | 'Nature' | 'Portrait' | 'Code & Tech';
    this.newPostCategory.set(val);
  }

  publishNewPost(): void {
    const captionText = this.newPostCaption().trim() || 'Deploying microservices with Spring Boot 3, PostgreSQL, Redis & Kafka! #java #angular #oauth2';
    const preset = this.scenePresets[this.newPostSceneIndex()] ?? this.scenePresets[0];
    const flt = this.newPostFilter();
    const newId = 'p-' + (100 + this.posts().length + 1);

    const created: PostItem = {
      id: newId,
      authorId: this.currentUser().id,
      authorUsername: this.currentUser().username,
      authorDisplayName: this.currentUser().displayName,
      authorAvatar: this.currentUser().avatar,
      authorVerified: true,
      location: this.newPostLocation().trim() || 'Kolkata, India',
      caption: captionText,
      category: this.newPostCategory(),
      filterClass: flt.css,
      filterLabel: flt.label,
      svgScene: preset.svg,
      likes: 1,
      likedByMe: true,
      bookmarkedByMe: false,
      createdAt: 'Just now',
      comments: []
    };

    this.posts.update(list => [created, ...list]);
    this.newPostCaption.set('');
    this.showCreateModal.set(false);
    this.activeTab.set('feed');

    this.recordTelemetry('POST', '/api/v1/posts', 18, 'REDIS_WRITE + KAFKA_PUB');
    this.pushKafkaEvent(
      'social.post.created',
      this.currentUser().username,
      'POST_CREATED',
      `{"postId":"${newId}","category":"${created.category}","filter":"${flt.label}"}`
    );
    this.updateRedisEntry(`feed:timeline:${this.currentUser().username}`, 'STRING (JSON)', 300, `Updated with ${newId} (${this.posts().length} posts)`);
    this.showToast(`Published post ${newId} to PostgreSQL and broadcast to Kafka topic social.post.created.`);
  }

  openStory(story: StoryItem): void {
    this.stories.update(list => list.map(s => (s.id === story.id ? { ...s, viewed: true } : s)));
    this.activeStory.set(story);
    this.recordTelemetry('GET', `/api/v1/stories/${story.id}`, 4, 'REDIS_HIT');
  }

  closeStory(): void {
    this.activeStory.set(null);
  }

  addQuickStory(): void {
    const newStory: StoryItem = {
      id: 'st-' + Date.now(),
      username: this.currentUser().username,
      displayName: this.currentUser().displayName,
      avatar: this.currentUser().avatar,
      title: 'Live from Angular 18 + Spring Boot!',
      subtitle: 'Story cached in Redis with 24-hour TTL & Kafka notification fan-out.',
      gradient: 'bg-gradient-to-br from-indigo-600 via-pink-600 to-amber-500',
      viewed: false,
      createdAt: 'Just now'
    };
    this.stories.update(list => [newStory, ...list]);
    this.activeStory.set(newStory);
    this.recordTelemetry('POST', '/api/v1/stories', 12, 'REDIS_WRITE + KAFKA_PUB');
  }

  toggleFollowUser(userId: string): void {
    let targetName = '';
    let followedNow = false;
    this.suggestedUsers.update(list =>
      list.map(u => {
        if (u.id !== userId) return u;
        followedNow = !u.isFollowedByMe;
        targetName = u.username;
        return {
          ...u,
          isFollowedByMe: followedNow,
          followers: followedNow ? u.followers + 1 : u.followers - 1
        };
      })
    );
    this.currentUser.update(me => ({
      ...me,
      following: followedNow ? me.following + 1 : me.following - 1
    }));
    this.recordTelemetry('POST', `/api/v1/users/${userId}/follow`, 13, 'REDIS_WRITE + KAFKA_PUB');
    this.pushKafkaEvent(
      'social.notification.fanout',
      this.currentUser().username,
      followedNow ? 'USER_FOLLOWED' : 'USER_UNFOLLOWED',
      `{"actor":"${this.currentUser().username}","target":"${targetName}"}`
    );
  }

  selectThread(threadId: string): void {
    this.activeThreadId.set(threadId);
  }

  onDmInput(event: Event): void {
    this.dmDraft.set((event.target as HTMLInputElement).value);
  }

  sendDirectMessage(): void {
    const text = this.dmDraft().trim();
    if (!text) return;
    const threadId = this.activeThreadId();
    const msg: DirectMessage = {
      id: 'm-' + Date.now(),
      sender: this.currentUser().username,
      text,
      time: 'Just now',
      fromMe: true
    };
    this.threads.update(list =>
      list.map(t => (t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t))
    );
    this.dmDraft.set('');
    this.recordTelemetry('POST', `/api/v1/messages/${threadId}`, 10, 'REDIS_WRITE + KAFKA_PUB');
    this.pushKafkaEvent(
      'social.notification.fanout',
      this.currentUser().username,
      'DIRECT_MESSAGE_SENT',
      `{"threadId":"${threadId}","length":${text.length}}`
    );
  }

  switchOAuthProvider(provider: 'Keycloak OIDC' | 'Google OAuth2' | 'GitHub OAuth2'): void {
    this.currentUser.update(u => ({ ...u, provider }));
    this.jwtNonce.set('jti-' + Math.random().toString(36).substring(2, 10));
    this.recordTelemetry('POST', '/oauth2/token (PKCE Code Exchange)', 22, 'OAUTH2_TOKEN_EXCHANGE');
    this.pushKafkaEvent(
      'social.auth.audit',
      this.currentUser().username,
      'OAUTH2_PROVIDER_SWITCH',
      `{"provider":"${provider}","grantType":"authorization_code_pkce"}`
    );
    this.showToast(`Authenticated via ${provider} with RS256 Bearer JWT.`);
  }

  rotateJwtToken(): void {
    this.jwtNonce.set('jti-' + Math.random().toString(36).substring(2, 10));
    this.recordTelemetry('POST', '/oauth2/token?grant_type=refresh_token', 16, 'OAUTH2_TOKEN_EXCHANGE');
    this.showToast('Rotated OAuth2 RS256 Access Token via Refresh Token grant.');
  }

  simulateBurstTraffic(): void {
    this.rateLimitUsed.update(v => Math.min(100, v + 15));
    this.updateRedisEntry('rl:ip:127.0.0.1', 'COUNTER (RateLimit)', 58, `${this.rateLimitUsed()} / 100 req/min`);
    this.showToast(`Simulated +15 API requests in Redis sliding-window rate limiter (${this.rateLimitUsed()}/100 rpm).`);
  }

  resetRateLimiter(): void {
    this.rateLimitUsed.set(1);
    this.updateRedisEntry('rl:ip:127.0.0.1', 'COUNTER (RateLimit)', 60, '1 / 100 req/min');
    this.showToast('Reset Redis rate-limiting counter key rl:ip:127.0.0.1.');
  }

  flushRedisCache(): void {
    this.redisMisses.update(v => v + 1);
    this.redisEntries.set([
      {
        key: 'rl:ip:127.0.0.1',
        type: 'COUNTER (RateLimit)',
        ttlSeconds: 60,
        valuePreview: `${this.rateLimitUsed()} / 100 req/min`,
        lastUpdated: 'Just now'
      }
    ]);
    this.recordTelemetry('GET', '/api/v1/posts/feed (Fallback to PostgreSQL)', 39, 'REDIS_MISS -> PG_QUERY');
    this.showToast('Executed Redis FLUSHDB. Next feed request fetched from PostgreSQL 16 (39ms) and repopulated cache.');
  }

  clearToast(): void {
    this.toastMessage.set('');
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
  }

  private recordTelemetry(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    latencyMs: number,
    cacheOutcome: ApiTraceLog['cacheOutcome']
  ): void {
    this.rateLimitUsed.update(v => Math.min(100, v + 1));
    const now = new Date().toTimeString().split(' ')[0];
    const entry: ApiTraceLog = {
      id: 'tr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      method,
      endpoint,
      status: 200,
      latencyMs,
      cacheOutcome,
      timestamp: now
    };
    this.apiTraces.update(list => [entry, ...list.slice(0, 14)]);
  }

  private pushKafkaEvent(
    topic: KafkaEventLog['topic'],
    key: string,
    eventType: string,
    payload: string
  ): void {
    const now = new Date().toTimeString().split(' ')[0];
    const nextOffset = 1043 + this.kafkaEvents().length;
    const ev: KafkaEventLog = {
      id: 'kev-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      topic,
      partition: nextOffset % 3,
      offset: nextOffset,
      key,
      eventType,
      payload,
      timestamp: now
    };
    this.kafkaEvents.update(list => [ev, ...list.slice(0, 19)]);
  }

  private updateRedisEntry(
    key: string,
    type: RedisCacheEntry['type'],
    ttlSeconds: number,
    valuePreview: string
  ): void {
    this.redisEntries.update(list => {
      const exists = list.some(item => item.key === key);
      const updated: RedisCacheEntry = {
        key,
        type,
        ttlSeconds,
        valuePreview,
        lastUpdated: 'Just now'
      };
      if (exists) {
        return list.map(item => (item.key === key ? updated : item));
      }
      return [updated, ...list];
    });
  }
}
