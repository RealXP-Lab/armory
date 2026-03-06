# Unity C# Style Guide

## Naming conventions

- **PascalCase**: Names of namespaces, classes, structs, methods, enumerations, properties, files, directories, public fields, and constant fields.
- **camelCase**: Names of local variables and method parameters.
- **\_camelCase**: Names of private, protected, internal and protected internal instance fields (no `m_`, `s_`, or `k_` prefixes).
- Always explicitly specify access modifiers (e.g. `private`, `public`, `internal`).
- **Variables**: Use nouns. Be descriptive and avoid abbreviations. (e.g. `playerHealth`, `enemyCount`, `scoreMultiplier`).
- **Units**: Add units to measurable quantities (e.g. `rotationRadians`, `transitionSeconds`, `colorFactor0To1`).
- **Booleans**: Prefix with a verb (e.g. `isAnimated`, `hasPowerUp`, `canJump`).
- **Enums**: Use singular nouns (e.g. `WeaponType`).
  - Bitwise enums marked with `[System.Flags]` are the exception—use plural names (e.g. `AttackModes`).
- Avoid redundant naming. Do not repeat the class name in member names unnecessarily (e.g. use `Score` instead of `PlayerScore` inside a `Player` class).
- **Methods**: Prefix with a verb (e.g. `StartGame()`, `GetDirection()`).
  - Methods returning `bool` should ask a question (e.g. `IsGameOver()`, `HasStartedTurn()`).
- **Interfaces**: Prefix with capital `I` followed by a descriptive adjective or phrase (e.g. `IDamageable`, `ISaveable`).
- **Events**:
  - Use verb phrases to name events. Ensure they clearly describe the state change.
  - Use the present participle (e.g. `OpeningDoor`) to indicate an event that occurs before the action completes.
  - Use the past participle (e.g. `DoorOpened`) to indicate an event that occurs after the action has completed.
  - Use the `System.Action` delegate by default. Only define custom `EventArgs` types when necessary.
  - Prefix event raising methods with `On` (e.g. `OnDoorOpened()`).
  - Prefix event handler methods with the subject name and underscore (e.g. `GameEvents_DoorOpened`).
- **MonoBehaviour files**: File name must match the MonoBehaviour class. Only one MonoBehaviour per file.

## Whitespace rules

- Use Allman style (brace on a new line).
- Indentation with 4 spaces. Do not use tabs.
- Keep line lengths under 120 characters.
- Always use braces, even for one-line `if`/`else`.
- Write one declaration per line: `int health;`.
- Write one statement per line and one assignment per statement.
- Place a space before flow conditions: `if (x == y)`.
- Do not place a space between method name and parentheses: `Jump()`.
- Do not place a space inside array brackets: `items[i]`.
- Place a space after commas: `DoSomething(x, y, z)`.
- Do not place a space after opening or before closing parentheses: `DoSomething(x)`.
- Do not place a space after a cast: `var x = (float)y`.

## Organization

- Use namespaces to prevent naming conflicts with global or external types, specifically core systems and editor scripts consumed across multiple files.
- Add `using` directives at the top of the file to avoid repeated namespace references.
  - Always place `System` imports first, then sort the rest alphabetically.
  - Strip unused `using` directives—keep only the minimally required set.
- Organize class members in the following order:
  1. Fields
  2. Properties
  3. Events
  4. Unity methods (Awake, Start, Update, OnControllerColliderHit, etc.)
  5. Public methods
  6. Private methods
  7. Nested classes or structs
- Avoid `#region` unless absolutely necessary.

## Comments

- Assume the _what_ is clear from the code; use comments to explain _why_—intent or reasoning. If naming can replace a comment, rename first.
- Start with a capital letter and avoid periods unless the comment is a full sentence.
- Use `TODO` comments to mark follow-ups. Pair each with a Notion ticket or owner when possible.
- Avoid leaving commented-out code in PRs. Use version control instead.
- Use XML summary tags for all public types and public methods. Avoid summary tags on Unity lifecycle functions.

## Inspector attributes

- Use one inspector attribute per line. Place attributes immediately above the member, without blank lines.
- Prefer `[Tooltip]` over code comments for fields exposed in the Inspector.
- For auto-properties, use `[field: SerializeField]` to expose the backing field while maintaining encapsulation.

## Coding guidelines

### Constants & readonly

- Use `const` where possible; otherwise use `readonly`.
- Prefer named constants to magic numbers.

### Collections & types

- For method inputs, use the most restrictive collection types (`IEnumerable<T>`, `IReadOnlyList<T>`, etc.).
- Use `List<T>` for outputs unless lazy evaluation is needed.
- Prefer `List<T>` over arrays unless size is fixed, data is multidimensional, or required.

### Tuples & return types

- Prefer named classes over `Tuple<>` for return types.
- Consider return objects for complex/multi-value returns.

### Strings

- Prefer string interpolation for readability (e.g. `$"Score: {playerScore}"`).
- Prefer a reused `StringBuilder` in hot paths that build large/variable text.

### LINQ & delegates

- Avoid long LINQ chains—prefer readability.
- Prefer method/extension syntax over LINQ query expressions (e.g. `Where()` over `from...in...where`).
- Avoid `.ForEach()` on lists unless it is a one-liner.
- Avoid LINQ in methods that run every frame (`Update`, `FixedUpdate`, etc.).
- Use `?.Invoke()` to call delegates.

### Extension methods

- Prefer adding directly to class. Use extension methods only when modifying source is not possible.
- Limit extensions to general-purpose methods.

### Structs vs classes

- Use structs only for small, immutable, short-lived types.
- Default to class unless performance or memory constraints justify struct.

### Miscellaneous

- Use `== null` for null checks over `is null` or `object.ReferenceEquals(x, null)`.
- Use `var` only when the type is obvious from context.
- Prefer `switch` over long `if-else` chains when appropriate.
- Avoid excessively long methods and large parameter lists.
- Avoid method overloading unless necessary.
