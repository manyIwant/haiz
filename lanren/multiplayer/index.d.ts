export const FRAME_ID: 'haiz-campus-v1';
export const PROTOCOL_VERSION: 1;
export type Motion = 'idle' | 'walk' | 'run' | 'jump';
export type PlayerSource = 'user' | 'npc' | 'ecosystem';
export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  motion: Motion;
}
export type VirtualPlayerState = Readonly<Pose & {
  id: string;
  nickname: string;
  source: PlayerSource;
  timestamp: number;
  isLocal: boolean;
}>;
export type Sample = { mode?: 'network' | 'display'; time?: number };
export type Connection = Readonly<{
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  roomId: string | null;
  playerId: string | null;
  detail: string | null;
}>;
export type LeaveReason = 'connection' | 'disconnect' | 'presence' | 'session' | 'timeout' | 'visibility';
export interface PlayerEventMap<Player> {
  connection: Connection;
  join: Readonly<{ player: Player }>;
  leave: Readonly<{ player: Player; reason: LeaveReason }>;
  update: Readonly<{ player: Player }>;
}
interface PlayerReader<Player> {
  getPlayers(options?: Sample): Player[];
  getPlayer(id: string, options?: Sample): Player | null;
  getConnection(): Connection;
  subscribe<E extends keyof PlayerEventMap<Player>>(
    event: E, callback: (data: PlayerEventMap<Player>[E]) => void,
  ): () => void;
}
export interface MultiplayerClient extends PlayerReader<VirtualPlayerState> {
  connect(roomId: string): Promise<void>;
  disconnect(): Promise<void>;
  destroy(): Promise<void>;
  setNickname(nickname: string): boolean;
  setVisible(visible: boolean): Promise<void>;
  setBackground(background: boolean): void;
  updateLocalPlayer(pose: Partial<Pose>): boolean;
}
export type MapPlayer = VirtualPlayerState & Readonly<{
  campus: Readonly<{ x: number; z: number; yaw: number }>;
  plan: Readonly<{ px: number; py: number }>;
}>;
export interface CampusFrame {
  toCampus(x: number, z: number): { x: number; z: number };
  rotation: number;
  transform: { originPx: readonly number[]; scale: number };
}
export interface MapAccess extends PlayerReader<MapPlayer> {
  frameId: typeof FRAME_ID;
  project(player: VirtualPlayerState): MapPlayer;
}
interface TransportHooks {
  signal?: AbortSignal;
  onPresence(id: string, entries: unknown[]): void;
  onPacket(id: string, data: unknown): void;
  onLost(error: Error): void;
}
interface TransportHandle {
  ownId: string;
  capacity: number;
  activate(): void;
  track(value: unknown): Promise<void>;
  untrack(): Promise<void>;
  send(payload: unknown): Promise<void>;
  close(): Promise<void>;
}
export interface MultiplayerTransport {
  open(roomId: string, hooks: TransportHooks): Promise<TransportHandle>;
}
export function createSupabaseTransport(supabase: object, options?: { timeout?: number }): MultiplayerTransport;
export function createMultiplayerClient(options: {
  transport: MultiplayerTransport;
  bounds?: Partial<{ x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }>;
  onError?: (error: unknown) => void;
}): MultiplayerClient;
export function createMapAccess(client: PlayerReader<VirtualPlayerState>, frame: CampusFrame): MapAccess;
export function projectPlayer(player: VirtualPlayerState, frame: CampusFrame): MapPlayer;
