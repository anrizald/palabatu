export type NotificationType =
    | 'comment'
    | 'send'
    | 'report_resolved'
    | 'content_removed'
    | 'reaction'
    | 'problem_edited'
    | 'problem_deleted'
    | 'mention'
    | 'merge_suggested'
    | 'merge_objected'
    | 'merge_resolved';

export type Notification = {
    id: string;
    type: NotificationType;
    problem_id: string | null;
    problem_name: string | null;
    actor_name: string | null;
    message: string;
    read: boolean;
    created_at: string;
};
