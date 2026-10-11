# Background

This app needs to be able to search the site entered, get the top 5 search results and also go through the attachment if present in the returned results and use it to generate the summary.

# Requirements

- Accept the search query from the user
- Select the search engine from the dropdown or allow selecting all. For now, support Bing and Google or all only
- Also allow seledcting an option for with/without attachment or do not use attachment filter
- Allow number of search results as a config with default as 3
- On click of search, search with the search engine(s) for the requisite query and attachment filter
- Present the search results as a list with search highlight, rank, engine, attachment if any, url, etc.
- For each of the search results, also extract the content from the attachment if the search results page contains any, and convert it into markdown along with the search result content/ page
- Once ready, show it against each row with eye icon
- Allow user to generate a summary by combining these top results across search engine results
- Visualize this markdown properly
- Use react/vite for UI
- All config only in .env
- Use browser only flow with webllm, similar to webllmpoc project with corresponding settings for this project too
- Use the similar UI for this project as webllmpoc
- Support dark, light mode
- Add favicon
- Make a modern, responsive UI that is professional
- Come up with the name, read me indicating how to use it, with screenshot, etc.
- Capture and track the telemetry
- Use the settings to indicate whether to store the search results or not. If yes, then store these in indexeddb and show it on click of search history
- Allow removing a specific search result or all based on time range or typical datetime filter or specific search result
- Add relevant analytics dashboard
- The app should be a browser only app  