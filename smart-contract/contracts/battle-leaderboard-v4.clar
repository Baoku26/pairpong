;; Crypto Pong Battle - Leaderboard Contract
;; Manages battle predictions, results, and player statistics (NO STAKING).

;; Constants
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant MIN-PERFORMANCE-DELTA u1)
(define-constant CONTRACT-OWNER tx-sender)

;; Data Maps and Variables
(define-map player-stats principal {
    total-predictions: uint,
    correct-predictions: uint,
    wrong-predictions: uint,
    points: uint,
    highest-delta: uint
})

(define-map battle-history uint {
    player: principal,
    coin-a: (string-ascii 10),
    coin-b: (string-ascii 10),
    predicted-winner: (string-ascii 10),
    actual-winner: (string-ascii 10),
    was-correct: bool,
    delta: uint,
    score-a: uint,
    score-b: uint,
    timestamp: uint
})

(define-data-var battle-count uint u0)

;; Points system
(define-constant POINTS-PER-CORRECT-PREDICTION u10)
(define-constant BONUS-POINTS-HIGH-DELTA u5) ;; Extra points if delta > 5%

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
    (predicted-winner (string-ascii 10))
    (actual-winner (string-ascii 10))
    (performance-delta uint)
    (score-a uint)
    (score-b uint)
)
    (let
        (
            (player-address tx-sender)
            (current-stats (default-to 
                {total-predictions: u0, correct-predictions: u0, wrong-predictions: u0, points: u0, highest-delta: u0} 
                (map-get? player-stats player-address)
            ))
            (new-battle-id (get-next-battle-id))
            (was-correct (is-eq predicted-winner actual-winner))
            (delta-over-500 (> performance-delta u500)) ;; 5.00% = 500 basis points
        )

        ;; Calculate points earned
        (let
            (
                (base-points (if was-correct POINTS-PER-CORRECT-PREDICTION u0))
                (bonus-points (if (and was-correct delta-over-500) BONUS-POINTS-HIGH-DELTA u0))
                (total-points-earned (+ base-points bonus-points))
            )

            ;; Update player stats
            (map-set player-stats
                player-address
                {
                    total-predictions: (+ (get total-predictions current-stats) u1),
                    correct-predictions: (if was-correct 
                        (+ (get correct-predictions current-stats) u1) 
                        (get correct-predictions current-stats)
                    ),
                    wrong-predictions: (if (not was-correct) 
                        (+ (get wrong-predictions current-stats) u1) 
                        (get wrong-predictions current-stats)
                    ),
                    points: (+ (get points current-stats) total-points-earned),
                    highest-delta: (if (and was-correct (> performance-delta (get highest-delta current-stats)))
                        performance-delta
                        (get highest-delta current-stats)
                    )
                }
            )

            ;; Record battle history
            (map-set battle-history
                new-battle-id
                {
                    player: player-address,
                    coin-a: coin-a,
                    coin-b: coin-b,
                    predicted-winner: predicted-winner,
                    actual-winner: actual-winner,
                    was-correct: was-correct,
                    delta: performance-delta,
                    score-a: score-a,
                    score-b: score-b,
                    timestamp: block-height
                }
            )

            (ok {
                battle-id: new-battle-id,
                was-correct: was-correct,
                points-earned: total-points-earned
            })
        )
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

;; Get accuracy percentage (correct predictions / total predictions * 100)
(define-read-only (get-accuracy (player principal))
    (let
        (
            (stats (unwrap! (map-get? player-stats player) (ok u0)))
            (total (get total-predictions stats))
            (correct (get correct-predictions stats))
        )
        (if (is-eq total u0)
            (ok u0)
            (ok (/ (* correct u100) total))
        )
    )
)