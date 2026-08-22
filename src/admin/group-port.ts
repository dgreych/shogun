export interface GroupParticipantView {
  readonly id: string;
  readonly lid?: string | null;
  readonly admin?: string | null;
}

export interface GroupMetadataView {
  readonly subject: string;
  readonly desc?: string | null;
  readonly participants: readonly GroupParticipantView[];
}

export interface GroupJoinRequest {
  readonly jid: string;
}

export type GroupRequestAction = 'approve' | 'reject';
export type GroupSettingAction = 'announcement' | 'not_announcement';

export interface AdminGroupPort {
  metadata(groupId: string): Promise<GroupMetadataView>;
  inviteCode(groupId: string): Promise<string>;
  listJoinRequests(groupId: string): Promise<readonly GroupJoinRequest[]>;
  updateJoinRequests(
    groupId: string,
    users: readonly string[],
    action: GroupRequestAction,
  ): Promise<void>;
  setSubject(groupId: string, subject: string): Promise<void>;
  setDescription(groupId: string, description: string): Promise<void>;
  setAnnouncement(groupId: string, onlyAdmins: boolean): Promise<void>;
  send(groupId: string, content: unknown, options?: unknown): Promise<unknown>;
}

type QueryNode = {
  readonly tag?: string;
  readonly attrs?: Record<string, string>;
  readonly content?: readonly QueryNode[];
};

type LegacyAdminSocket = {
  groupMetadata?: (jid: string) => Promise<GroupMetadataView>;
  groupInviteCode?: (jid: string) => Promise<string>;
  groupGetRequestParticipants?: (jid: string) => Promise<readonly GroupJoinRequest[]>;
  groupRequestParticipantsList?: (jid: string) => Promise<readonly GroupJoinRequest[]>;
  groupRequestParticipantsUpdate?: (
    jid: string,
    users: readonly string[],
    action: GroupRequestAction,
  ) => Promise<unknown>;
  groupUpdateSubject?: (jid: string, subject: string) => Promise<unknown>;
  groupUpdateDescription?: (jid: string, description: string) => Promise<unknown>;
  groupSettingUpdate?: (jid: string, setting: GroupSettingAction) => Promise<unknown>;
  query?: (node: QueryNode) => Promise<QueryNode>;
  sendMessage?: (jid: string, content: unknown, options?: unknown) => Promise<unknown>;
};

function requireMethod<T extends (...args: never[]) => unknown>(
  method: T | undefined,
  name: string,
): T {
  if (typeof method !== 'function') throw new Error(`Socket não expõe ${name}.`);
  return method;
}

/** Adapter de transporte. Domínios administrativos não conhecem Baileys. */
export class BaileysAdminGroupPort implements AdminGroupPort {
  readonly #socket: LegacyAdminSocket;

  public constructor(socket: unknown) {
    if (!socket || typeof socket !== 'object') throw new Error('Socket administrativo inválido.');
    this.#socket = socket as LegacyAdminSocket;
  }

  public metadata(groupId: string): Promise<GroupMetadataView> {
    const method = requireMethod(this.#socket.groupMetadata, 'groupMetadata');
    return method.call(this.#socket, groupId);
  }

  public inviteCode(groupId: string): Promise<string> {
    const method = requireMethod(this.#socket.groupInviteCode, 'groupInviteCode');
    return method.call(this.#socket, groupId);
  }

  public async listJoinRequests(groupId: string): Promise<readonly GroupJoinRequest[]> {
    if (typeof this.#socket.groupGetRequestParticipants === 'function') {
      return this.#socket.groupGetRequestParticipants.call(this.#socket, groupId);
    }
    if (typeof this.#socket.groupRequestParticipantsList === 'function') {
      return this.#socket.groupRequestParticipantsList.call(this.#socket, groupId);
    }
    const query = requireMethod(this.#socket.query, 'query');
    const result = await query.call(this.#socket, {
      tag: 'iq',
      attrs: { type: 'get', xmlns: 'w:g2', to: groupId },
      content: [{ tag: 'membership_approval_requests', attrs: {} }],
    });
    const node = result.content?.find((item) => item.tag === 'membership_approval_requests');
    return (node?.content ?? [])
      .filter((item) => item.tag === 'membership_approval_request' && typeof item.attrs?.jid === 'string')
      .map((item) => ({ jid: item.attrs?.jid ?? '' }))
      .filter((item) => item.jid.length > 0);
  }

  public async updateJoinRequests(
    groupId: string,
    users: readonly string[],
    action: GroupRequestAction,
  ): Promise<void> {
    const method = requireMethod(
      this.#socket.groupRequestParticipantsUpdate,
      'groupRequestParticipantsUpdate',
    );
    await method.call(this.#socket, groupId, users, action);
  }

  public async setSubject(groupId: string, subject: string): Promise<void> {
    const method = requireMethod(this.#socket.groupUpdateSubject, 'groupUpdateSubject');
    await method.call(this.#socket, groupId, subject);
  }

  public async setDescription(groupId: string, description: string): Promise<void> {
    const method = requireMethod(this.#socket.groupUpdateDescription, 'groupUpdateDescription');
    await method.call(this.#socket, groupId, description);
  }

  public async setAnnouncement(groupId: string, onlyAdmins: boolean): Promise<void> {
    const method = requireMethod(this.#socket.groupSettingUpdate, 'groupSettingUpdate');
    await method.call(this.#socket, groupId, onlyAdmins ? 'announcement' : 'not_announcement');
  }

  public async send(groupId: string, content: unknown, options?: unknown): Promise<unknown> {
    const method = requireMethod(this.#socket.sendMessage, 'sendMessage');
    return method.call(this.#socket, groupId, content, options);
  }
}
