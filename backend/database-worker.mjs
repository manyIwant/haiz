import { parentPort, workerData } from 'node:worker_threads';
import { createRepository } from './repository.mjs';
const repository = createRepository(workerData.directory);
let queue = Promise.resolve();
parentPort.on('message', message => {
  queue = queue.then(async () => {
    try {
      const result = await repository.run(message.operation, message.args);
      parentPort.postMessage({ id: message.id, result });
    } catch (error) {
      parentPort.postMessage({ id: message.id, error: {
        status: error.status || 500,
        message: error.status ? error.message : '数据库操作失败',
        extra: error.remote ? { remote: error.remote } : {},
      } });
    }
  });
});
parentPort.postMessage({ ready: true });
