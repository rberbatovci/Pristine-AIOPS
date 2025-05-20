from opensearchpy import OpenSearch

opensearch_client = OpenSearch(
    ['http://localhost:9200'],  # Change the address to your OpenSearch server
    http_auth=('admin', 'admin'),  # Use your actual credentials if needed
    use_ssl=False,  # Change to True if SSL is enabled
    verify_certs=False
)

# Check connection
try:
    info = opensearch_client.info()
    print("Connected to OpenSearch:", info)
except Exception as e:
    print("Error connecting to OpenSearch:", e)