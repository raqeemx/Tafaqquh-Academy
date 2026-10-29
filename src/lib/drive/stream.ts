// Validate the provider before sending bytes; reject truncated/oversized bodies too.
export async function checkedMedia(
  response: Response,
  start: number,
  end: number,
  size: number,
) {
  const length = end - start + 1;
  if (
    !response.body ||
    response.status !== 206 ||
    response.headers.get("content-range") !== `bytes ${start}-${end}/${size}` ||
    (response.headers.has("content-length") &&
      Number(response.headers.get("content-length")) !== length)
  ) {
    await response.body?.cancel();
    throw new Error("Invalid media range response");
  }
  let bytes = 0;
  return response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > length) {
          controller.error(new Error("Media range overflow"));
          return;
        }
        controller.enqueue(chunk);
      },
      flush(controller) {
        if (bytes !== length)
          controller.error(new Error("Truncated media range"));
      },
    }),
  );
}
