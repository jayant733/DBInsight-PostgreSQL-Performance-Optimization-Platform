-- Q3 Restore environment after Bitmap experiment: restore Q1/Q3 partial index, drop temp date index
ROLLBACK;
RESET enable_hashjoin;
RESET enable_nestloop;
RESET enable_mergejoin;
RESET enable_seqscan;
RESET enable_indexscan;
RESET enable_indexonlyscan;
RESET enable_bitmapscan;
RESET jit;

