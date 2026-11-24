"""Regulile Dirty Santa, fără bază de date.

Starea jocului nu se salvează: se recalculează mereu din ordinea jucătorilor și
lista de mutări. Așa, undo înseamnă doar „șterge ultima mutare”, iar starea nu
poate rămâne pe jumătate modificată.

Mutările:
- open:       jucătorul de la rând desface un cadou nou (cadoul primește un număr);
- steal:      jucătorul de la rând fură un cadou deja desfăcut; păgubitul e următorul la rând;
- final_swap: la ultima șansă, primul jucător își schimbă cadoul cu unul neblocat;
- keep:       la ultima șansă, primul jucător rămâne cu cadoul lui.

Un cadou e identificat prin `seq`-ul mutării `open` care l-a desfăcut.

Un cadou se poate fura oricând (chiar și înapoi, imediat) până atinge limita de
furturi. Jocul se termină sigur: fiecare furt apropie un cadou de blocare.
"""
from dataclasses import dataclass, field

MIN_STEAL_LIMIT = 1
MAX_STEAL_LIMIT = 5
DEFAULT_STEAL_LIMIT = 3

PHASE_MAIN = 'main'
PHASE_FINAL = 'final'
PHASE_DONE = 'done'


class RuleError(ValueError):
    """Mutare care nu respectă regulile. `key` e cheia mesajului din app/i18n.py."""

    def __init__(self, key):
        super().__init__(key)
        self.key = key


@dataclass
class Move:
    seq: int
    kind: str
    actor_id: int
    target_seq: int | None = None


@dataclass
class Gift:
    id: int
    number: int  # al câtelea cadou desfăcut (1, 2, 3…): așa îl recunosc oamenii din cameră
    opened_by: int
    holder_id: int
    steals: int = 0


@dataclass
class GameState:
    order: list[int]
    steal_limit: int
    final_round: bool
    gifts: dict[int, Gift] = field(default_factory=dict)
    holder: dict[int, int] = field(default_factory=dict)  # jucător -> cadou
    current: int | None = None
    phase: str = PHASE_MAIN
    next_index: int = 1  # următorul jucător din ordine care n-a avut încă rândul
    # Pentru istoric și premii.
    victims: dict[int, int] = field(default_factory=dict)  # seq furt -> păgubit
    steals_by: dict[int, int] = field(default_factory=dict)
    robbed: dict[int, int] = field(default_factory=dict)

    @property
    def finished(self):
        return self.phase == PHASE_DONE

    @property
    def opened_count(self):
        return len(self.gifts)

    @property
    def unopened_count(self):
        return len(self.order) - len(self.gifts)

    def is_locked(self, gift):
        return gift.steals >= self.steal_limit

    def can_steal(self, gift_id):
        """Dacă jucătorul de la rând poate lua cadoul (furt sau schimb la ultima șansă)."""
        gift = self.gifts.get(gift_id)
        if gift is None or self.current is None or gift.holder_id == self.current or self.is_locked(gift):
            return False
        if self.phase == PHASE_MAIN:
            return True
        if self.phase == PHASE_FINAL:
            own = self.gifts[self.holder[self.current]]
            return not self.is_locked(own)
        return False

    def stealable_ids(self):
        return [gid for gid in self.gifts if self.can_steal(gid)]


def _advance_after_open(state):
    if state.next_index < len(state.order):
        state.current = state.order[state.next_index]
        state.next_index += 1
        return
    # Toată lumea are un cadou.
    first = state.order[0]
    state.current = first
    if state.final_round and len(state.order) > 1:
        state.phase = PHASE_FINAL
        # Ultima șansă are sens doar dacă primul jucător chiar poate lua ceva.
        if state.stealable_ids():
            return
    state.phase = PHASE_DONE
    state.current = None


def _take(state, gift_id, taker):
    """Mută cadoul la `taker` și întoarce fostul deținător."""
    gift = state.gifts[gift_id]
    victim = gift.holder_id
    gift.holder_id = taker
    gift.steals += 1
    state.holder[taker] = gift_id
    state.steals_by[taker] = state.steals_by.get(taker, 0) + 1
    state.robbed[victim] = state.robbed.get(victim, 0) + 1
    return victim


def apply_move(state, move):
    """Aplică o mutare pe stare sau aruncă RuleError. Nu modifică starea dacă mutarea e refuzată."""
    if state.finished or state.current is None:
        raise RuleError('dirty_game_over')
    if move.actor_id != state.current:
        raise RuleError('dirty_not_your_turn')

    if move.kind == 'open':
        if state.phase != PHASE_MAIN or state.unopened_count <= 0:
            raise RuleError('dirty_invalid_move')
        number = len(state.gifts) + 1
        state.gifts[move.seq] = Gift(id=move.seq, number=number, opened_by=move.actor_id, holder_id=move.actor_id)
        state.holder[move.actor_id] = move.seq
        _advance_after_open(state)
        return

    if move.kind in ('steal', 'final_swap'):
        expected_phase = PHASE_MAIN if move.kind == 'steal' else PHASE_FINAL
        if state.phase != expected_phase:
            raise RuleError('dirty_invalid_move')
        gift = state.gifts.get(move.target_seq)
        if gift is None:
            raise RuleError('dirty_gift_not_found')
        if gift.holder_id == state.current:
            raise RuleError('dirty_invalid_move')
        if state.is_locked(gift):
            raise RuleError('dirty_gift_locked')
        if not state.can_steal(gift.id):
            raise RuleError('dirty_gift_locked')

        if move.kind == 'steal':
            victim = _take(state, gift.id, state.current)
            del state.holder[victim]
            state.victims[move.seq] = victim
            state.current = victim
            return

        # Ultima șansă: schimb direct, fără un lanț nou.
        own_id = state.holder[state.current]
        victim = _take(state, gift.id, state.current)
        state.gifts[own_id].holder_id = victim
        state.holder[victim] = own_id
        state.victims[move.seq] = victim
        state.phase = PHASE_DONE
        state.current = None
        return

    if move.kind == 'keep':
        if state.phase != PHASE_FINAL:
            raise RuleError('dirty_invalid_move')
        state.phase = PHASE_DONE
        state.current = None
        return

    raise RuleError('dirty_invalid_move')


def replay(order, moves, steal_limit=DEFAULT_STEAL_LIMIT, final_round=True):
    """Starea după toate mutările salvate. Mutările salvate au trecut deja de validare."""
    state = GameState(order=list(order), steal_limit=steal_limit, final_round=final_round)
    state.current = state.order[0] if state.order else None
    for move in moves:
        apply_move(state, move)
    return state


def awards(state):
    """Premiile de la final: id-urile câștigătorilor (sau None dacă nimeni nu le merită)."""
    def top(counts):
        if not counts:
            return None
        best = max(counts.values())
        if best <= 0:
            return None
        return sorted(pid for pid, count in counts.items() if count == best)

    gift_steals = {gid: g.steals for gid, g in state.gifts.items()}
    return {
        'biggest_thief': top(state.steals_by),
        'most_wanted_gift': top(gift_steals),
        'unlucky': top(state.robbed),
    }
