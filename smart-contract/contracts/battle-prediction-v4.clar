;; Crypto Pong Battle - Prediction Contract
;; Manages user predictions BEFORE battles start (NO MONEY INVOLVED).

;; Constants
(define-constant ERR-PREDICTION-EXISTS (err u100))
(define-constant ERR-PREDICTION-NOT-FOUND (err u101))
(define-constant ERR-ALREADY-SETTLED (err u102))
(define-constant CONTRACT-OWNER tx-sender)

;; Data Maps
;; Tracks predictions made before a battle starts
(define-map predictions uint {
    player: principal,
    coin-a: (string-ascii 10),
    coin-b: (string-ascii 10),
    predicted-winner: (string-ascii 10),
    is-settled: bool,
    timestamp: uint
})

(define-data-var next-prediction-id uint u1)

;; Helper Functions
(define-private (get-next-prediction-id)
    (let ((current-id (var-get next-prediction-id)))
        (var-set next-prediction-id (+ current-id u1))
        current-id
    )
)

;; Public Functions

;; @desc User submits their prediction BEFORE starting the battle
;; @param coin-a First cryptocurrency symbol
;; @param coin-b Second cryptocurrency symbol  
;; @param predicted-winner Which coin user thinks will win
(define-public (submit-prediction
    (coin-a (string-ascii 10))
    (coin-b (string-ascii 10))
    (predicted-winner (string-ascii 10))
)
    (let
        (
            (prediction-id (get-next-prediction-id))
            (player tx-sender)
        )

        ;; Validate prediction is either coin-a or coin-b
        (asserts! (or (is-eq predicted-winner coin-a) (is-eq predicted-winner coin-b)) 
            (err u103))

        ;; Store prediction
        (map-set predictions prediction-id
            {
                player: player,
                coin-a: coin-a,
                coin-b: coin-b,
                predicted-winner: predicted-winner,
                is-settled: false,
                timestamp: block-height
            }
        )

        (ok prediction-id)
    )
)

;; @desc Marks a prediction as settled (called after battle ends)
;; @param prediction-id The ID of the prediction to settle
(define-public (settle-prediction (prediction-id uint))
    (let
        (
            (prediction (unwrap! (map-get? predictions prediction-id) ERR-PREDICTION-NOT-FOUND))
        )

        ;; Only the player who made the prediction can settle it
        (asserts! (is-eq tx-sender (get player prediction)) (err u104))
        (asserts! (not (get is-settled prediction)) ERR-ALREADY-SETTLED)

        ;; Mark as settled
        (map-set predictions prediction-id
            (merge prediction { is-settled: true })
        )

        (ok true)
    )
)

;; Read-Only Functions
(define-read-only (get-prediction (prediction-id uint))
    (map-get? predictions prediction-id)
)

(define-read-only (get-next-prediction-id-read)
    (ok (var-get next-prediction-id))
)

;; Check if a player has an unsettled prediction
(define-read-only (has-active-prediction (player principal))
    ;; Note: This is a simplified check. In production, you'd want to 
    ;; track active predictions per player in a separate map.
    (ok false)
)