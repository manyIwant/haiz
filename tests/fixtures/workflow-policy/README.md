Deliberately unsafe workflows for `python3 tests/acceptance/workflow_policy.py --expect-fail tests/fixtures/workflow-policy/*.yml`.
They are outside `.github/workflows/`, so GitHub never runs them. Each must fail the policy check.
