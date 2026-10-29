#!/usr/bin/env python3
"""Write phpunit.shard.xml containing one balanced slice of the test suite.

Usage: scripts/ci/phpunit-shard.py <shard 1..N> <total shards>
Then:  vendor/bin/phpunit -c phpunit.shard.xml

Why not paratest / `artisan test --parallel`: neither is a dependency of this
repo, and CI shards run on separate runners anyway. This copies phpunit.xml
(so the <php> env, bootstrap and coverage settings stay the single source of
truth) and swaps only the <testsuites> block.

Files are split greedily by size (largest first onto the lightest shard), a
good-enough proxy for runtime that is deterministic across runners.
"""
import os
import re
import sys

SUITE_DIRS = ("tests/Unit", "tests/Feature")  # keep in sync with phpunit.xml
SUFFIX = "Test.php"


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    shard, total = int(sys.argv[1]), int(sys.argv[2])
    if not 1 <= shard <= total:
        print(f"shard must be within 1..{total}")
        return 2

    files = []
    for suite_dir in SUITE_DIRS:
        for root, _, names in os.walk(suite_dir):
            files += [os.path.join(root, n) for n in names if n.endswith(SUFFIX)]
    if not files:
        print("no test files found; run from the repository root")
        return 1

    files.sort(key=lambda f: (-os.path.getsize(f), f))
    bins = [[0, []] for _ in range(total)]
    for f in files:
        lightest = min(bins, key=lambda b: b[0])
        lightest[0] += os.path.getsize(f)
        lightest[1].append(f)

    mine = sorted(bins[shard - 1][1])
    suite = (
        "<testsuites>\n"
        f'        <testsuite name="shard-{shard}-of-{total}">\n'
        + "\n".join(f"            <file>./{f}</file>" for f in mine)
        + "\n        </testsuite>\n    </testsuites>"
    )
    with open("phpunit.xml", encoding="utf-8") as fh:
        xml = fh.read()
    xml, count = re.subn(r"<testsuites>.*?</testsuites>", suite, xml, flags=re.S)
    if count != 1:
        print("could not find a single <testsuites> block in phpunit.xml")
        return 1
    with open("phpunit.shard.xml", "w", encoding="utf-8") as fh:
        fh.write(xml)
    print(f"shard {shard}/{total}: {len(mine)} of {len(files)} test files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
