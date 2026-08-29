-- Restore environment after Bitmap comparison
ROLLBACK;
RESET enable_hashjoin;
RESET enable_nestloop;
RESET enable_mergejoin;
