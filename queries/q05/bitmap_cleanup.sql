-- Q5 Restore environment after Bitmap experiment
ROLLBACK;
RESET enable_hashjoin;
RESET enable_nestloop;
RESET enable_mergejoin;
RESET enable_seqscan;
RESET enable_indexscan;
RESET enable_indexonlyscan;
RESET enable_bitmapscan;
RESET jit;
