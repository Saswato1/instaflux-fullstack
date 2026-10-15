package com.instaflux.messaging;

import com.instaflux.events.SocialEvent;
import com.instaflux.service.RedisFeedCacheService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class KafkaSocialEventBus {

    private static final Logger log = LoggerFactory.getLogger(KafkaSocialEventBus.class);

    public static final String TOPIC_POST_CREATED = "social.post.created";
    public static final String TOPIC_INTERACTION_LIKED = "social.interaction.liked";
    public static final String TOPIC_NOTIFICATION_FANOUT = "social.notification.fanout";

    private final KafkaTemplate<String, SocialEvent> kafkaTemplate;
    private final RedisFeedCacheService redisFeedCacheService;

    public KafkaSocialEventBus(
            KafkaTemplate<String, SocialEvent> kafkaTemplate,
            RedisFeedCacheService redisFeedCacheService) {
        this.kafkaTemplate = kafkaTemplate;
        this.redisFeedCacheService = redisFeedCacheService;
    }

    public void publishEvent(String topic, SocialEvent event) {
        kafkaTemplate.send(topic, event.actorUsername(), event);
        log.info("Published Kafka event [{}] key={} id={}", topic, event.actorUsername(), event.eventId());
    }

    @KafkaListener(topics = {TOPIC_POST_CREATED, TOPIC_INTERACTION_LIKED}, groupId = "instaflux-social-group")
    public void consumeSocialEvent(SocialEvent event) {
        log.info("Consumed Kafka event type={} actor={} post={}",
                event.eventType(), event.actorUsername(), event.targetPostId());
        // Fan out timeline cache invalidation & push notification event
        redisFeedCacheService.evictTimeline(event.actorUsername());
    }
}
