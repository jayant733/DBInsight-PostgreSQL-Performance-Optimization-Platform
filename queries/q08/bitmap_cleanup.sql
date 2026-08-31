-- Q8 Session settings and experimental index safety cleanup
DROP INDEX IF EXISTS ecom.idx_reviews_q8_bitmap_experiment;
RESET enable_seqscan;
RESET enable_indexscan;
RESET enable_indexonlyscan;
RESET enable_bitmapscan;
RESET enable_hashjoin;
RESET enable_nestloop;
RESET enable_mergejoin;
RESET jit;
