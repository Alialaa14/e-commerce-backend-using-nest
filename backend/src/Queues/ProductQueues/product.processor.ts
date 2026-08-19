import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as xlsx from 'xlsx';
@Processor('product')
export class ProductProcessor extends WorkerHost {
  async process(job: Job<any, any, string>) {
    switch (job.name) {
      case 'bulkImport':
        this.bulkImport(job.data);
    }
  }

  private bulkImport(filePath: string) {
    // First Get The File With Xlsx package
    const data = xlsx.readFile(filePath);
    console.log('At Product Processor  ');
    console.log(data);
    // Check the file type
    // Then Read The File and Check on the columns names whether in arabic or english
    // check the value of every row and make checks on the values and thier types
    console.log('At Product Processor');
    console.log(filePath);
  }
}
