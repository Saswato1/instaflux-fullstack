package com.instaflux.controller;

import com.instaflux.dto.PostResponseDto;
import com.instaflux.events.SocialEvent;
import com.instaflux.messaging.KafkaSocialEventBus;
import com.instaflux.service.RedisFeedCacheService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/posts")
public class PostController {

    private final RedisFeedCacheService redisCache;
    private final KafkaSocialEventBus kafkaBus;

    public PostController(RedisFeedCacheService redisCache, KafkaSocialEventBus kafkaBus) {
        this.redisCache = redisCache;
        this.kafkaBus = kafkaBus;
    }

    public record CreatePostRequest(
        @NotBlank String caption,
        @NotBlank String mediaUrl,
        String location,
        String filterName
    ) {}

    @GetMapping("/feed")
    public ResponseEntity<Map<String, Object>> getTimelineFeed(@AuthenticationPrincipal Jwt jwt) {
        String userSub = jwt != null ? jwt.getSubject() : "anonymous";
        var cached = redisCache.getCachedTimeline(userSub);
        if (cached.isPresent()) {
            return ResponseEntity.ok(Map.of(
                "cacheStatus", "REDIS_HIT",
                "principal", userSub,
                "posts", cached.get()
            ));
        }
        return ResponseEntity.ok(Map.of(
            "cacheStatus", "POSTGRES_FETCH_AND_CACHE",
            "principal", userSub,
            "posts", List.of()
        ));
    }

    @PostMapping
    public ResponseEntity<PostResponseDto> createPost(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreatePostRequest req) {
        String username = jwt != null ? jwt.getClaimAsString("preferred_username") : "arjun_dev";
        UUID newId = UUID.randomUUID();
        PostResponseDto dto = new PostResponseDto(
            newId, username, username, req.caption(), req.mediaUrl(),
            req.location(), req.filterName(), 0L, 0L, false, Instant.now()
        );

        kafkaBus.publishEvent(
            KafkaSocialEventBus.TOPIC_POST_CREATED,
            new SocialEvent(UUID.randomUUID().toString(), KafkaSocialEventBus.TOPIC_POST_CREATED,
                "POST_CREATED", username, newId, req.caption(), Instant.now())
        );

        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{postId}/likes")
    public ResponseEntity<Map<String, Object>> toggleLike(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID postId) {
        String username = jwt != null ? jwt.getClaimAsString("preferred_username") : "arjun_dev";
        Long updatedLikes = redisCache.incrementPostLikes(postId, 1L);

        kafkaBus.publishEvent(
            KafkaSocialEventBus.TOPIC_INTERACTION_LIKED,
            new SocialEvent(UUID.randomUUID().toString(), KafkaSocialEventBus.TOPIC_INTERACTION_LIKED,
                "POST_LIKED", username, postId, "Incremented like counter in Redis & Postgres", Instant.now())
        );

        return ResponseEntity.ok(Map.of(
            "postId", postId,
            "likes", updatedLikes,
            "redisKey", "post:metrics:" + postId
        ));
    }
}
