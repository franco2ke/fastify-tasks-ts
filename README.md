# Getting Started with [Fastify-CLI](https://www.npmjs.com/package/fastify-cli)

This project was bootstrapped with Fastify-CLI.

## Available Scripts

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.

## Setting up the database

### Pull Latest Docker image

`docker pull postgres`

### Run PostgreSQL in a Docker container

`docker run --name postgres-dev \
  -e POSTGRES_PASSWORD=p@ssword123 \
  -e POSTGRES_USER=francis \
  -e POSTGRES_DB=fastify_todo \
  -p 5432:5432 \
  -v postgres-dev-data:/var/lib/postgresql/data \
  -d postgres`

### Stopping Container

`docker stop postgres-db`

### Starting Container

`docker start postgres-db`

### Removing Container

`docker rm postgres-db`

### Verify Container is running

`docker ps`

### Enabling Persistent Storage

By default data in a container is lost when the container is removed. With databases we usually want to keep the data

Solution: Use docker volumes to store data outside the container file system

- Inspecting a volume

`docker volume inspect postgres-data`

- Creating a volume

`docker volume create postgres-data`

- Check if a volume exists

`docker volume ls`

- Remove existing volume

`docker volume rm postgres-data`

- List volumes

`docker volume ls`

- List all containers with their volumes

`docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Mounts}}"`

- Show volume usage

`docker system df -v`

### Connecting to Database running in the container

To connect to the PostgreSQL database running in the container from your host machine

`docker exec -it <container_name> psql -U youruser -d yourdatabase`

## Timezone Configuration (Common Issue)

By default, PostgreSQL containers run in UTC timezone, which can cause timestamp inconsistencies if your application server is in a different timezone. This manifests as `created_at` and `updated_at` timestamps being several hours off from when actions actually occurred.

### Symptoms

- Task timestamps show times that are hours behind/ahead of when you actually created/updated them
- Database `NOW()` function returns times that don't match your local time

### Solution

1. **Check your current timezone:**

   ```bash
   date
   ```

2. **Check PostgreSQL container timezone:**

   ```bash
   docker exec postgres-dev date
   ```

3. **Fix database timezone (recommended approach):**

   ```bash
   # Set timezone for your specific database
   docker exec postgres-dev psql -U francis -d fastify_todo -c "ALTER DATABASE fastify_todo SET timezone = 'Africa/Nairobi';"

   # Optional: Set server-wide default timezone for all databases
   docker exec postgres-dev psql -U francis -d postgres -c "ALTER SYSTEM SET timezone = 'Africa/Nairobi';"
   docker restart postgres-dev
   ```

4. **Restart your application server** to pick up the new database timezone setting.

5. **Verify the fix:**
   ```bash
   docker exec postgres-dev psql -U francis -d fastify_todo -c "SELECT NOW(), current_setting('timezone');"
   ```

### Common Timezones

- East Africa Time: `'Africa/Nairobi'`
- UTC: `'UTC'`
- US Eastern: `'America/New_York'`
- Europe/London: `'Europe/London'`

Replace `'Africa/Nairobi'` with your appropriate timezone from the [PostgreSQL timezone list](https://www.postgresql.org/docs/current/view-pg-timezone-names.html).

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
