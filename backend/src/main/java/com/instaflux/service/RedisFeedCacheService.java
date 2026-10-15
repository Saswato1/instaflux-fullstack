package com.instaflux.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.instaflux.dto.PostResponseDto;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class RedisFeedCacheService {

    private static final String FEED_KEY_PREFIX = "feed:timeline:";
    private static final String POST_METRICS_PREFIX = "post:metrics:";
    private static final Duration FEED_TTL = Duration.ofMinutes(5);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public RedisFeedCacheService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public Optional<List<PostResponseDto>> getCachedTimeline(String userSub) {
        try {
            String raw = redisTemplate.opsForValue().get(FEED_KEY_PREFIX + userSub);
            if (raw == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(raw, new TypeReference<List<PostResponseDto>>() {}));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public void cacheTimeline(String userSub, List<PostResponseDto> posts) {
        try {
            String payload = objectMapper.writeValueAsString(posts);
            redisTemplate.opsForValue().set(FEED_KEY_PREFIX + userSub, payload, FEED_TTL);
        } catch (Exception ignored) {
        }
    }

    public void evictTimeline(String userSub) {
        redisTemplate.delete(FEED_KEY_PREFIX + userSub);
    }

    public Long incrementPostLikes(UUID postId, long delta) {
        return redisTemplate.opsForHash().increment(POST_METRICS_PREFIX + postId, "likes", delta);
    }
}
