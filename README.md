[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Josesoll/tiny-stack-vm-20261122/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Josesoll/tiny-stack-vm-20261122/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

# Tiny Stack VM

A compact interpreter for make.fun's tiny stack ISA. It mirrors the
reference VM's step order exactly — step limit, pc range, unknown opcode,
truncated immediate, generic stack underflow/overflow, then the
instruction's own trap — and keeps every value a wrapping 32-bit integer,
so the edge cases (signed/unsigned division, shift masking, output and
call limits, traps that keep prior output) match the reference.
