"""Step 1: Batch import files from GCS into Agent Search datastore."""

from common import ExecutionContext, FatalStepError
from localPackages.core.discovery_engine_client import get_discovery_engine_client


def execute(context: ExecutionContext) -> None:
    try:
        input_data = context.input_data
        files = input_data.files

        if not files or len(files) == 0:
            raise FatalStepError(
                step_name="step1_upload_files_batch",
                message="files配列が空です",
                error_code="EMPTY_FILES_ARRAY",
            )

        if len(files) > 50:
            raise FatalStepError(
                step_name="step1_upload_files_batch",
                message="files配列は最大50件までです",
                error_code="FILES_ARRAY_TOO_LARGE",
            )

        store_id = context.get("store_id")
        if not store_id:
            raise FatalStepError(
                step_name="step1_upload_files_batch",
                message="store_id is required",
                error_code="MISSING_STORE_ID",
            )

        client = get_discovery_engine_client()
        results = []

        for index, file_input in enumerate(files):
            try:
                bucket_name = file_input.bucket_name
                file_path = file_input.file_path
                result = client.import_from_gcs(
                    data_store_id=store_id,
                    bucket_name=bucket_name,
                    file_path=file_path,
                )
                results.append(
                    {
                        "statusCode": 200,
                        "response": result.get("response", {}),
                        "error": None,
                    }
                )
                if context.logger:
                    doc_id = result.get("response", {}).get("agentSearchDocumentId")
                    context.logger.info(
                        f"✅ File {index + 1}/{len(files)} imported: {doc_id}",
                        emoji="✅",
                    )
            except Exception as e:
                error_msg = str(e)
                results.append(
                    {
                        "statusCode": 500,
                        "response": None,
                        "error": {
                            "message": error_msg,
                            "file_path": file_input.file_path,
                        },
                    }
                )
                if context.logger:
                    context.logger.error(
                        f"❌ File {index + 1}/{len(files)} import failed: {error_msg}",
                        emoji="❌",
                        exc_info=True,
                    )

        context.set("batch_results", results)

        success_count = sum(1 for r in results if r["statusCode"] == 200)
        error_count = len(results) - success_count
        if context.logger:
            context.logger.info(
                f"✅ Batch import completed: {success_count} succeeded, {error_count} failed",
                emoji="✅",
            )

    except FatalStepError:
        raise
    except Exception as e:
        raise FatalStepError(
            step_name="step1_upload_files_batch",
            message=f"Unexpected error: {str(e)}",
            error_code="UNEXPECTED_ERROR",
        ) from e
