from opensearchpy import OpenSearch

client = OpenSearch(
    hosts=[{'host': 'localhost', 'port': 9200}],
    http_auth=('user','pass')  # if you have security enabled
)

# delete-by-query
resp = client.delete_by_query(
    index='syslogs',
    body={'query': {'match_all': {}}}
)
print(f"Deleted {resp['deleted']} documents")

# refresh
client.indices.refresh(index='syslogs')
