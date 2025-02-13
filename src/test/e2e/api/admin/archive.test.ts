import dbInit from '../../helpers/database-init';
import { setupApp } from '../../helpers/test-helper';
import getLogger from '../../../fixtures/no-logger';

let app;
let db;

beforeAll(async () => {
    db = await dbInit('archive_test_serial', getLogger);
    app = await setupApp(db.stores);
});

afterAll(async () => {
    await app.destroy();
    await db.destroy();
});

test('Should get empty features via admin', async () => {
    await app.request
        .get('/api/admin/archive/features')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect((res) => {
            expect(res.body.features).toHaveLength(0);
        });
});

test('Should be allowed to reuse deleted toggle name', async () => {
    await app.request
        .post('/api/admin/projects/default/features')
        .send({
            name: 'ts.really.delete',
            archived: true,
        })
        .expect(201);
    await app.request
        .post('/api/admin/features/validate')
        .send({ name: 'ts.really.delete' })
        .expect(409);
    await app.request.delete('/api/admin/archive/ts.really.delete').expect(200);
    await app.request
        .post('/api/admin/features/validate')
        .send({ name: 'ts.really.delete' })
        .expect(200);
});

test('Should get archived toggles via admin', async () => {
    await app.request
        .post('/api/admin/projects/default/features')
        .send({
            name: 'archived.test.1',
            archived: true,
        })
        .expect(201);
    await app.request
        .post('/api/admin/projects/default/features')
        .send({
            name: 'archived.test.2',
            archived: true,
        })
        .expect(201);
    await app.request
        .get('/api/admin/archive/features')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect((res) => {
            expect(res.body.features).toHaveLength(2);
        });
});

test('Should be able to revive toggle', async () => {
    await app.request.post('/api/admin/projects/default/features').send({
        name: 'archived.revival',
        archived: true,
    });
    await app.request
        .post('/api/admin/archive/revive/archived.revival')
        .send({})
        .expect(200);
});

test('Reviving a non-existing toggle should yield 404', async () => {
    await app.request
        .post('/api/admin/archive/revive/non.existing')
        .send({})
        .expect(404);
});
