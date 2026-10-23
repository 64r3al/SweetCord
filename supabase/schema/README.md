# Identity and Friends Schema

`identity-friends.sql` is the reviewed schema source for SweetCord's native accounts and friend graph.

**Do not apply this to the existing Exam website project.** Once a dedicated SweetCord project exists, generate a CLI migration with `supabase migration new identity_friends`, move this SQL into that generated migration file, link the new project, and apply/test it against that project.

The schema provides:

- A profile row created automatically after Supabase Auth user creation.
- Unique lowercase usernames and a separate display name.
- Pending friend requests, recipient-only accept/decline permissions, and a friendship record created by a database trigger after acceptance.
- Row Level Security for profiles, requests, and friendships.
- Exact-username lookup returning only the minimum public profile fields.
- Private trigger functions in a non-exposed schema with fixed search paths.
