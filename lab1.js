
const API_URL = "https://jsonplaceholder.typicode.com/posts";


function getArg(name, defaultValue) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return defaultValue;
  return arg.split("=")[1];
}


async function fetchPosts() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid JSON: expected array");
    }

    return data;
  } catch (error) {
    throw new Error("Failed to fetch posts: " + error.message);
  }
}


function processPost(post) {
  return {
    id: post.id,
    userId: post.userId,
    title: post.title.toUpperCase(),
    bodyPreview: post.body.slice(0, 40).replace(/\n/g, " ")
  };
}


async function runPipeline(posts, workersCount, userIdFilter) {
  const filteredPosts =
    userIdFilter !== null
      ? posts.filter((post) => post.userId === userIdFilter)
      : posts;

  const chunks = [];
  for (let i = 0; i < workersCount; i++) {
    chunks.push([]);
  }

  filteredPosts.forEach((post, index) => {
    chunks[index % workersCount].push(post);
  });

  const workerPromises = chunks.map(async (chunk, workerIndex) => {
    const result = [];

    for (const post of chunk) {
      try {
        const processed = processPost(post);
        result.push({
          worker: workerIndex + 1,
          ...processed
        });
      } catch (error) {
        console.error(`Worker ${workerIndex + 1} error: ${error.message}`);
      }
    }

    return result;
  });

  const results = await Promise.all(workerPromises);
  return results.flat();
}


async function main() {
  try {
    const limit = parseInt(getArg("limit", "2"));
    const userIdRaw = getArg("userId", "");
    const workers = parseInt(getArg("workers", "3"), 10);

    if (isNaN(limit) || limit <= 0) {
      throw new Error("limit must be a positive number");
    }

    if (isNaN(workers) || workers <= 0) {
      throw new Error("workers must be a positive number");
    }

    const userId =
      userIdRaw === "" ? null : parseInt(userIdRaw, 10);

    if (userIdRaw !== "" && (isNaN(userId) || userId <= 0)) {
      throw new Error("userId must be a positive number");
    }

    const posts = await fetchPosts();

    const limitedPosts = posts.slice(0, limit);

    const result = await runPipeline(limitedPosts, workers, userId);

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();