/** Error codes the command layer can raise. Kept as a closed union for tests. */
export type CommandErrorCode =
  | 'participant_exists'
  | 'participant_not_found'
  | 'invalid_state'
  | 'not_qualified'
  | 'already_prompted'
  | 'wallet_not_prompted'
  | 'wallet_not_connected';

/**
 * A precondition failure in a command handler. Commands validate the derived
 * participant state before appending, so an invalid call throws rather than
 * writing a nonsensical event into the append-only log.
 */
export class CommandError extends Error {
  readonly code: CommandErrorCode;
  constructor(code: CommandErrorCode, message: string) {
    super(message);
    this.name = 'CommandError';
    this.code = code;
  }
}
