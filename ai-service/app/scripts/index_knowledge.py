from app.services.rag_service import index_documents


def main():
    result = index_documents(force=True)
    print(result)


if __name__ == "__main__":
    main()
