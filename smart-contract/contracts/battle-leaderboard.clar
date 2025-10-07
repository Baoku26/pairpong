;; Crypto Pong Battle - Leaderboard Contract
;; Manages persistent storage for battle results and player statistics.

;; Constants
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant MIN-PERFORMANCE-DELTA u1)
(define-constant CONTRACT-OWNER tx-sender)

;; Data Maps and Variables
(define-map player-stats principal {
    wins: uint,
    losses: uint,
    highest-delta: uint
})

(define-map battle-history uint {
    player: principal,
    winner: (string-ascii 10),
    loser: (string-ascii 10),
    delta: uint,
    score-a: uint,
    score-b: uint
})

(define-data-var battle-count uint u0)

;; Helper Functions
(define-read-only (contract-owner)
    CONTRACT-OWNER
)

(define-private (is-authorized)
    (is-eq tx-sender CONTRACT-OWNER)
)

(define-private (get-next-battle-id)
    (let ((current-id (var-get battle-count)))
        (var-set battle-count (+ current-id u1))
        current-id
    )
)

;; Public Functions
(define-public (submit-battle
    (coin-a (string-ascii 10))
    (coin-b (string-ascii 10))
    (winner (string-ascii 10))
    (performance-delta uint)
    (score-a uint)
    (score-b uint)
)
    (let
        (
            (player-address tx-sender)
            (loser (if (is-eq winner coin-a) coin-b coin-a))
            (current-stats (default-to {wins: u0, losses: u0, highest-delta: u0} (map-get? player-stats player-address)))
            (new-battle-id (get-next-battle-id))
            (was-win (is-eq winner coin-a))
        )

        (if (>= performance-delta MIN-PERFORMANCE-DELTA)
            (begin
                (map-set player-stats
                    player-address
                    {
                        wins: (if was-win (+ (get wins current-stats) u1) (get wins current-stats)),
                        losses: (if (not was-win) (+ (get losses current-stats) u1) (get losses current-stats)),
                        highest-delta: (if (and was-win (> performance-delta (get highest-delta current-stats)))
                                        performance-delta
                                        (get highest-delta current-stats)
                                        )
                    }
                )
            )
            (print { reason: "Delta too low to qualify for leaderboard." })
        )

        (map-set battle-history
            new-battle-id
            {
                player: player-address,
                winner: winner,
                loser: loser,
                delta: performance-delta,
                score-a: score-a,
                score-b: score-b
            }
        )

        (ok new-battle-id)
    )
)

;; Read-Only Functions
(define-read-only (get-user-stats (user principal))
    (map-get? player-stats user)
)

(define-read-only (get-battle-count)
    (ok (var-get battle-count))
)

(define-read-only (get-battle-by-id (battle-id uint))
    (map-get? battle-history battle-id)
)

(define-read-only (get-leaderboard-stats (player principal))
    (map-get? player-stats player)
)