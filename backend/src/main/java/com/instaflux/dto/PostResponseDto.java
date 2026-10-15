package com.instaflux.dto;

import java.time.Instant;
import java.util.UUID;

public record PostResponseDto(
    UUID id,
    String authorUsername,
    String authorDisplayName,
    String caption,
    String mediaUrl,
    String location,
    String filterName,
    long likeCount,
    long commentCount,
    boolean likedByCurrentUser,
    Instant createdAt
) {}
