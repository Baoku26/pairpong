;; Crypto Pong Battle - Leaderboard Contract
;; Manages persistent storage for battle results and player statistics.

;; --- Constants ---
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant MIN-PERFORMANCE-DELTA u1) ; Minimum delta required to count for leaderboards

;; --- Data Maps and Variables ---

;; Stores individual user stats (wins, losses, highest delta)
;; Key: principal (user address)
;; Value: {
;;   wins: uint,
;;   losses: uint,
;;   highest-delta: uint ; highest performance-delta achieved in a single win
;; }
(define-map player-stats principal {
    wins: uint,
    losses: uint,
    highest-delta: uint
})

;; Stores a history of every battle
;; Key: uint (battle ID)
;; Value: {
;;   player: principal, ; The principal who submitted the result
;;   winner: (string-ascii 10), ; The coin that won (e.g., "STX")
;;   loser: (string-ascii 10), ; The coin that lost
;;   delta: uint, ; Performance delta of the winner
;;   score-a: uint, ; Score of Coin A
;;   score-b: uint ; Score of Coin B
;; }
(define-map battle-history uint {
    player: principal,
    winner: (string-ascii 10),
    loser: (string-ascii 10),
    delta: uint,
    score-a: uint,
    score-b: uint
})

;; Tracks the total number of battles for generating the ID
(define-data-var battle-count uint u0)

;; --- Helper Functions ---

;; Only the contract deployer can call this for maintenance tasks if needed.
;; For this submission, we assume the frontend sends the battle result directly.
(define-private (is-authorized)
    (is-eq tx-sender (contract-owner))
)

;; Gets the current battle count and increments it
(define-private (get-next-battle-id)
    (let ((current-id (var-get battle-count)))
        (var-set battle-count (+ current-id u1))
        current-id
    )
)

;; --- Public Functions ---

;; @desc Submits a battle result, updates player stats, and records history.
;; @param coin-a The ticker of Coin A.
;; @param coin-b The ticker of Coin B.
;; @param winner The ticker of the coin that won the battle.
;; @param performance-delta The calculated performance delta of the winner's coin (multiplied by 100).
;; @param score-a Final Pong score for Coin A.
;; @param score-b Final Pong score for Coin B.
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
        (was-win (is-eq winner coin-a)) ;; Assuming player is associated with Coin A for stat tracking in this example
        )

        ;; 1. Update Player Stats (assuming the tx-sender is the one playing and associated with the winner's side)
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

    ;; 2. Record Battle History
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

    ;; 3. Return the battle ID on success
    (ok new-battle-id)
  )
)

;; --- Read-Only Functions ---

;; @desc Retrieves the statistics for a given user.
;; @param user The principal (address) to query.
(define-read-only (get-user-stats (user principal))
    (map-get? player-stats user)
)

;; @desc Retrieves the total number of battles recorded.
(define-read-only (get-battle-count)
    (ok (var-get battle-count))
)

;; @desc Retrieves a specific battle result by ID.
;; @param battle-id The ID of the battle to retrieve.
(define-read-only (get-battle-by-id (battle-id uint))
    (map-get? battle-history battle-id)
)

;; NOTE: In Clarity, complex sorting (like for a true leaderboard) is typically handled off-chain
;; via the API/Indexer to avoid excessive execution costs and complexity.
;; This function provides the total stats needed for off-chain ranking.
(define-read-only (get-leaderboard-stats (player principal))
    (map-get? player-stats player)
)