-- Enable realtime for join_requests table to notify users of approval/rejection
ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;