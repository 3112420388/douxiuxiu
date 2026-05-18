-- ===================================================================
-- 抖咻咻数据库 - 圈子与聊天室模块
-- 创建时间: 2024-01-01
-- 说明: 本文件包含圈子系统和聊天室系统的完整数据库结构
-- ===================================================================

-- ============================================================
-- 第一部分: 用户系统 (基础表)
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `username` varchar(50) NOT NULL COMMENT '用户名',
  `password` varchar(255) NOT NULL COMMENT '密码哈希',
  `avatar` varchar(500) DEFAULT '' COMMENT '头像URL',
  `email` varchar(100) DEFAULT '' COMMENT '邮箱',
  `device_id` varchar(255) DEFAULT '' COMMENT '设备ID',
  `signature` varchar(200) DEFAULT '' COMMENT '个性签名',
  `role` tinyint(1) DEFAULT 0 COMMENT '0-普通用户 1-管理员 2-超级管理员',
  `coins` int(11) DEFAULT 100 COMMENT '金币余额',
  `vip_expire` int(11) DEFAULT 0 COMMENT 'VIP到期时间戳(0表示不是VIP)',
  `is_banned` tinyint(1) DEFAULT 0 COMMENT '是否被封禁 0-正常 1-封禁',
  `ban_reason` varchar(255) DEFAULT '' COMMENT '封禁原因',
  `created_at` int(11) DEFAULT 0 COMMENT '注册时间',
  UNIQUE KEY `username` (`username`),
  KEY `device_id` (`device_id`),
  KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=1000 DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 示例用户数据
INSERT INTO `users` (`id`, `username`, `password`, `avatar`, `role`, `coins`, `vip_expire`, `created_at`) VALUES
(1000, '张三', '$2y$10$placeholder_hash_here', 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1', 0, 500, 0, UNIX_TIMESTAMP()),
(1001, '管理员', '$2y$10$placeholder_hash_here', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', 1, 9999, 1893456000, UNIX_TIMESTAMP()),
(1002, '李四', '$2y$10$placeholder_hash_here', 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2', 0, 250, 0, UNIX_TIMESTAMP());

-- ============================================================
-- 第二部分: 圈子系统
-- ============================================================

-- 2.1 圈子表
CREATE TABLE IF NOT EXISTS `circles` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(100) NOT NULL COMMENT '圈子名称(最多5个中文字)',
  `description` varchar(500) DEFAULT '' COMMENT '圈子描述',
  `icon` varchar(50) DEFAULT 'fa-hashtag' COMMENT 'FontAwesome图标类名',
  `color` varchar(20) DEFAULT '#3b82f6' COMMENT '主题色',
  `bg_image` varchar(500) DEFAULT '' COMMENT '背景图URL',
  `created_by` int(11) NOT NULL COMMENT '创建者用户ID',
  `member_count` int(11) DEFAULT 1 COMMENT '成员数(冗余字段,便于查询)',
  `post_count` int(11) DEFAULT 0 COMMENT '帖子数(冗余字段)',
  `created_at` int(11) DEFAULT 0 COMMENT '创建时间',
  KEY `created_by` (`created_by`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='圈子表';

-- 示例圈子数据
INSERT INTO `circles` (`id`, `name`, `description`, `icon`, `color`, `created_by`, `created_at`) VALUES
(1, '技术交流', '程序员技术分享与学习交流', 'fa-code', '#3b82f6', 1000, UNIX_TIMESTAMP()),
(2, '游戏部落', '游戏攻略、开黑组队、赛事讨论', 'fa-gamepad', '#10b981', 1001, UNIX_TIMESTAMP()),
(3, '动漫天地', '动漫讨论、资源分享、二次元文化', 'fa-tv', '#f43f5e', 1002, UNIX_TIMESTAMP());

-- 2.2 圈子成员表
CREATE TABLE IF NOT EXISTS `circle_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `circle_id` int(11) NOT NULL COMMENT '圈子ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `joined_at` int(11) DEFAULT 0 COMMENT '加入时间',
  UNIQUE KEY `circle_user_unique` (`circle_id`,`user_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='圈子成员表';

-- 示例成员数据
INSERT INTO `circle_members` (`circle_id`, `user_id`, `joined_at`) VALUES
(1, 1000, UNIX_TIMESTAMP()),  -- 张三加入技术交流
(1, 1001, UNIX_TIMESTAMP()),  -- 管理员加入技术交流
(1, 1002, UNIX_TIMESTAMP()),  -- 李四加入技术交流
(2, 1001, UNIX_TIMESTAMP()),  -- 管理员加入游戏部落
(3, 1002, UNIX_TIMESTAMP());  -- 李四加入动漫天地

-- 2.3 圈子帖子表
CREATE TABLE IF NOT EXISTS `circle_posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int(11) NOT NULL COMMENT '发帖用户ID',
  `circle_id` int(11) NOT NULL COMMENT '所属圈子ID',
  `title` varchar(200) DEFAULT '' COMMENT '帖子标题',
  `content` text COMMENT '帖子内容',
  `media_urls` json DEFAULT NULL COMMENT '媒体文件URL数组(JSON格式)',
  `like_count` int(11) DEFAULT 0 COMMENT '点赞数',
  `comment_count` int(11) DEFAULT 0 COMMENT '评论数',
  `total_coins` int(11) DEFAULT 0 COMMENT '收到的打赏总金币',
  `is_essence` tinyint(1) DEFAULT 0 COMMENT '是否精华 0-否 1-是',
  `is_top` tinyint(1) DEFAULT 0 COMMENT '是否置顶 0-否 1-是',
  `created_at` int(11) DEFAULT 0 COMMENT '发布时间',
  KEY `user_id` (`user_id`),
  KEY `circle_id` (`circle_id`),
  KEY `created_at` (`created_at`),
  KEY `circle_essence` (`circle_id`,`is_essence`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='圈子帖子表';

-- 示例帖子
INSERT INTO `circle_posts` (`id`, `user_id`, `circle_id`, `title`, `content`, `like_count`, `total_coins`, `created_at`) VALUES
(1, 1000, 1, 'PHP 8.2 新特性分享', '今天给大家分享PHP 8.2的几个实用新特性...\n\n1. readonly 类\n2. 独立类型 null/false/true\n3. 随机扩展改进', 15, 200, UNIX_TIMESTAMP()),
(2, 1001, 2, '原神4.0枫丹版本攻略', '新版本枫丹地区探索指南：\n- 水下世界玩法介绍\n- 新角色林尼培养建议\n- 枫丹声望任务攻略', 42, 500, UNIX_TIMESTAMP()),
(3, 1002, 3, '鬼灭之刃最新话讨论', '最新一话真是太精彩了！炭治郎的新招式简直帅炸！\n\n大家觉得后续剧情会怎么发展？', 8, 50, UNIX_TIMESTAMP());

-- 2.4 帖子点赞表
CREATE TABLE IF NOT EXISTS `circle_likes` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int(11) NOT NULL COMMENT '点赞用户ID',
  `post_id` int(11) NOT NULL COMMENT '帖子ID',
  `created_at` int(11) DEFAULT 0 COMMENT '点赞时间',
  UNIQUE KEY `user_post_unique` (`user_id`,`post_id`),
  KEY `post_id` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='帖子点赞表';

-- 2.5 帖子评论表 (新增)
CREATE TABLE IF NOT EXISTS `circle_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `post_id` int(11) NOT NULL COMMENT '所属帖子ID',
  `user_id` int(11) NOT NULL COMMENT '评论用户ID',
  `content` text NOT NULL COMMENT '评论内容',
  `reply_to` int(11) DEFAULT 0 COMMENT '回复的评论ID(0表示直接评论帖子)',
  `like_count` int(11) DEFAULT 0 COMMENT '点赞数',
  `created_at` int(11) DEFAULT 0 COMMENT '评论时间',
  KEY `post_id` (`post_id`),
  KEY `user_id` (`user_id`),
  KEY `reply_to` (`reply_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='帖子评论表';

-- 2.6 交易记录表
CREATE TABLE IF NOT EXISTS `circle_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int(11) NOT NULL COMMENT '操作者用户ID',
  `target_id` int(11) NOT NULL COMMENT '目标ID(帖子ID等)',
  `target_type` varchar(50) NOT NULL COMMENT '目标类型: post_reward-帖子打赏',
  `amount` int(11) NOT NULL COMMENT '金币数量(正数为收入,负数为支出)',
  `description` varchar(255) DEFAULT '' COMMENT '交易描述',
  `created_at` int(11) DEFAULT 0 COMMENT '交易时间',
  KEY `user_id` (`user_id`),
  KEY `target` (`target_type`,`target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易记录表';

-- ============================================================
-- 第三部分: 聊天室系统
-- ============================================================

-- 3.1 聊天消息表
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int(11) NOT NULL COMMENT '发送者用户ID',
  `type` varchar(20) DEFAULT 'text' COMMENT '消息类型: text-文本 image-图片',
  `content` text COMMENT '消息内容(文本内容或图片路径)',
  `quote_id` int(11) DEFAULT 0 COMMENT '引用的消息ID',
  `quote_content` text COMMENT '引用消息的内容',
  `quote_user` varchar(50) DEFAULT NULL COMMENT '引用消息的发送者用户名',
  `is_deleted` tinyint(1) DEFAULT 0 COMMENT '是否已撤回 0-正常 1-已撤回',
  `created_at` int(11) DEFAULT 0 COMMENT '发送时间',
  KEY `user_id` (`user_id`),
  KEY `created_at` (`created_at`),
  KEY `quote_id` (`quote_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天消息表';

-- 示例聊天消息
INSERT INTO `chat_messages` (`user_id`, `type`, `content`, `created_at`) VALUES
(1000, 'text', '大家好，欢迎来到抖咻咻聊天室！', UNIX_TIMESTAMP()),
(1001, 'text', '今天有什么新鲜事分享吗？', UNIX_TIMESTAMP() + 300),
(1002, 'text', '我刚发现一个超好用的工具！', UNIX_TIMESTAMP() + 600);

-- ============================================================
-- 第四部分: 存储过程
-- ============================================================

-- 4.1 获取用户活跃度统计
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `GetUserActivity`(IN p_user_id INT)
BEGIN
    SELECT 
        u.id,
        u.username,
        u.avatar,
        u.role,
        u.coins,
        (SELECT COUNT(*) FROM circle_posts WHERE user_id = u.id) as post_count,
        (SELECT COUNT(*) FROM circle_likes WHERE user_id = u.id) as like_given_count,
        (SELECT COUNT(*) FROM circle_comments WHERE user_id = u.id) as comment_count,
        (SELECT COUNT(*) FROM circles WHERE created_by = u.id) as owned_circles,
        (SELECT COUNT(*) FROM circle_members WHERE user_id = u.id) as joined_circles
    FROM users u
    WHERE u.id = p_user_id;
END //
DELIMITER ;

-- 4.2 获取用户发帖历史
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `GetUserPosts`(IN p_user_id INT)
BEGIN
    SELECT 
        p.*,
        u.username,
        u.avatar,
        c.name as circle_name,
        (SELECT COUNT(*) FROM circle_likes WHERE post_id = p.id AND user_id = p_user_id) as is_liked
    FROM circle_posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN circles c ON p.circle_id = c.id
    WHERE p.user_id = p_user_id
    ORDER BY p.created_at DESC
    LIMIT 50;
END //
DELIMITER ;

-- ============================================================
-- 第五部分: 视图
-- ============================================================

-- 5.1 圈子统计视图
CREATE OR REPLACE VIEW `v_circle_stats` AS
SELECT 
    c.id as circle_id,
    c.name as circle_name,
    c.description,
    c.icon,
    c.color,
    c.bg_image,
    u.id as owner_id,
    u.username as owner_name,
    u.avatar as owner_avatar,
    c.member_count,
    c.post_count,
    c.created_at
FROM circles c
LEFT JOIN users u ON c.created_by = u.id;

-- 5.2 帖子详情视图(含用户信息)
CREATE OR REPLACE VIEW `v_post_detail` AS
SELECT 
    p.*,
    u.username,
    u.avatar,
    u.role,
    c.name as circle_name,
    c.icon as circle_icon,
    c.color as circle_color
FROM circle_posts p
LEFT JOIN users u ON p.user_id = u.id
LEFT JOIN circles c ON p.circle_id = c.id;

-- ============================================================
-- 第六部分: 外键约束
-- ============================================================

ALTER TABLE `circles` ADD CONSTRAINT `fk_circles_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `circle_members` 
    ADD CONSTRAINT `fk_members_circle` FOREIGN KEY (`circle_id`) REFERENCES `circles` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `circle_posts` 
    ADD CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_posts_circle` FOREIGN KEY (`circle_id`) REFERENCES `circles` (`id`) ON DELETE CASCADE;

ALTER TABLE `circle_likes` 
    ADD CONSTRAINT `fk_likes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_likes_post` FOREIGN KEY (`post_id`) REFERENCES `circle_posts` (`id`) ON DELETE CASCADE;

ALTER TABLE `circle_comments` 
    ADD CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_comments_post` FOREIGN KEY (`post_id`) REFERENCES `circle_posts` (`id`) ON DELETE CASCADE;

ALTER TABLE `circle_transactions` 
    ADD CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `chat_messages` 
    ADD CONSTRAINT `fk_chat_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;