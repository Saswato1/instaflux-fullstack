package com.instaflux.events;

import java.time.Instant;
import java.util.UUID;

public record SocialEvent(
    String eventId,
    String topic,
    String eventType,
    String actorUsername,
    UUID targetPostId,
    String payloadSummary,
    Instant occurredAt
) {}
