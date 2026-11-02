# **MONITORING\_NODES FILE**

## **PART 1**

\-            Which of your API endpoints do you think will be the slowest, and why?  
> > > o   The endpoint for orders and Signals.  
§  The orders endpoint is a POST so by aspect of creating sometimes the foreign key set as the productid might take some time to be found.  
§  The signals endpoint has some computations that need to be done so that might cause it to be slightly slower.  
\-            Which endpoint do you think will produce the most errors, and why?  
> > > o   The orders endpoint  
§  This is because it has a foreign key constraint that might be violated which can in turn cause errors.

 

\# Monitoring & Metrics Notes \- Week 12

 

\#\# 1\. Predictions vs. Reality

\- \*\*Slowest Endpoint Prediction:\*\* Expected \`GET /tasks\` to be the slowest due to data array processing.

\- \*\*Actual Data:\*\* \`GET /tasks\` averaged \*\*0.6 ms\*\* with a max of \*\*1.3 ms\*\*. \`GET /stats\` was slightly higher initially (\*\*2.3 ms\*\*) due to JSON object construction.

\- \*\*Error Prediction:\*\* Expected most errors on invalid IDs.

\- \*\*Actual Data:\*\* Generated \*\*36 client errors\*\* (\`4xx\`) out of 60 total requests (\*\*36 GET (no route)\*\*), comprising 12 unauthenticated \`401\` attempts and 24 \`404\` invalid route/ID requests.

 

\#\# 2\. Real Traffic Pattern

Out of 60 simulated traffic requests:

\- \*\*24 successful calls\*\* to \`GET /tasks\` (avg \`0.6 ms\`).

\- \*\*36 client errors\*\* grouped under \`GET (no route)\` (avg \`0.9 ms\`, max \`7.1 ms\`).

\- \*\*0 server errors\*\* (\`5xx\`), maintaining an \`errorRatePercent\` of \*\*0.0%\*\*.

 

\#\# 3\. Analysis & Hypothesis

The large volume of \`(no route)\` occurrences stems from \`traffic.js\` testing unmapped endpoints (\`/not-a-route\`) and missing record IDs (\`/tasks/99\`). These calls terminate early in middleware without hitting inner route logic, keeping processing speed fast (\`0.9 ms\`).

 

\#\# 4\. Production Alert Proposal

\- \*\*Metric:\*\* \`errorRatePercent\` (\`5xx\` status codes).

\- \*\*Threshold:\*\* Alert if \`errorRatePercent\` exceeds \*\*5% over a 5-minute window\*\*.

\- \*\*Action:\*\* Notify the on-call developer via PagerDuty/Slack. Fallback mechanisms (from Week 11\) should serve cached data while server issues are investigated.

