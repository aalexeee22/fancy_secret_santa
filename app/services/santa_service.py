import secrets
from ..models import db

_rng = secrets.SystemRandom()


class SantaService:
    @staticmethod
    def draw_names(group) -> list[tuple]:
        """Trage la sorți pentru un grup deja blocat cu SELECT ... FOR UPDATE."""
        if group.is_drawn:
            raise ValueError("Tragerile de sorți au fost deja efectuate!")
        participants = list(group.participants)
        if len(participants) < 2:
            raise ValueError("Sunt necesari cel puțin 2 participanți pentru a trage la sorți!")

        # Amestecăm până nimeni nu se nimerește pe sine. Orice tragere validă are
        # aceeași șansă (nu doar cele care formează un singur cerc).
        receivers = participants[:]
        while True:
            _rng.shuffle(receivers)
            if all(giver.id != receiver.id for giver, receiver in zip(participants, receivers)):
                break

        pairs = []
        for giver, receiver in zip(participants, receivers):
            giver.assigned_to_id = receiver.id
            giver.email_sent = False
            pairs.append((giver, receiver))

        group.is_drawn = True
        # Ruta salvează repartizările și coada de email într-o singură tranzacție.
        db.session.flush()
        return pairs
