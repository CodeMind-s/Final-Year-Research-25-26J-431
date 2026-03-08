Integration tests go here.

Guidelines:
- Integration tests should exercise the controller + service wiring.
- Use Nest's TestingModule to bootstrap the controller and real providers where feasible.
- Keep external network calls mocked or use local test doubles.
- Run integration tests separately from unit tests.

Example command to run integration tests only:
```
npx jest --testPathPattern=apps/api-gateway/src/app/waste-valorization-service/tests/integration
```
