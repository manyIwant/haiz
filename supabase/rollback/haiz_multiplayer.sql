-- Operator-only. Export room invitations first if they must be restored.
-- This deletes HAIZ multiplayer room and membership metadata, not Pocket data.
begin;
drop policy if exists haiz_mp_owner_insert on realtime.messages;
drop policy if exists haiz_mp_member_select on realtime.messages;
drop policy if exists haiz_mp_guard_insert on realtime.messages;
drop policy if exists haiz_mp_guard_select on realtime.messages;
drop function if exists public.haiz_mp_directory(text);
drop function if exists haiz_multiplayer.may_use(text, boolean);
drop table if exists haiz_multiplayer.room_members;
drop table if exists haiz_multiplayer.rooms;
drop schema if exists haiz_multiplayer;
commit;
