import { DataSource } from 'typeorm';

export function getJsonColumnType(dataSource: DataSource): string {
    const driver = dataSource.driver;
    return driver.options.type === 'sqlite' ? 'simple-json' : 'jsonb';
}
