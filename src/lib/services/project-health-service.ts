import { IUnleashStores } from '../types/stores';
import { IUnleashConfig } from '../types/option';
import ProjectStore, { IProject } from '../db/project-store';
import { Logger } from '../logger';
import {
    FeatureToggle,
    IFeatureOverview,
    IProjectHealthReport,
} from '../types/model';
import {
    MILLISECONDS_IN_DAY,
    MILLISECONDS_IN_ONE_HOUR,
} from '../util/constants';
import FeatureTypeStore from '../db/feature-type-store';
import Timer = NodeJS.Timer;
import FeatureToggleStore from '../db/feature-toggle-store';

export default class ProjectHealthService {
    private logger: Logger;

    private projectStore: ProjectStore;

    private featureTypeStore: FeatureTypeStore;

    private featureToggleStore: FeatureToggleStore;

    private featureTypes: Map<string, number>;

    constructor(
        {
            projectStore,
            featureTypeStore,
            featureToggleStore,
        }: Pick<
            IUnleashStores,
            'projectStore' | 'featureTypeStore' | 'featureToggleStore'
        >,
        { getLogger }: Pick<IUnleashConfig, 'getLogger'>,
    ) {
        this.logger = getLogger('services/project-health-service.ts');
        this.projectStore = projectStore;
        this.featureTypeStore = featureTypeStore;
        this.featureToggleStore = featureToggleStore;
        this.featureTypes = new Map();
    }

    async getProjectHealthReport(
        projectId: string,
    ): Promise<IProjectHealthReport> {
        //const overview = await this.getProjectOverview(projectId, false);
        const features = await this.featureToggleStore.getFeaturesBy({
            project: projectId,
        });

        const overview = {
            name: 'test',
            description: '',
            features: features,
            members: 1,
        };
        const staleCount = this.staleCount(overview.features);
        const activeCount = this.activeCount(overview.features);
        const potentiallyStaleCount = await this.potentiallyStaleCount(
            overview.features,
        );
        const health = this.getHealthRating(
            overview.features.length,
            staleCount,
            potentiallyStaleCount,
        );
        return {
            ...overview,
            health,
            version: 1,
            potentiallyStaleCount,
            activeCount,
            staleCount,
        };
    }

    private async potentiallyStaleCount(
        features: Pick<FeatureToggle, 'createdAt' | 'stale' | 'type'>[],
    ): Promise<number> {
        const today = new Date().valueOf();
        if (this.featureTypes.size === 0) {
            const types = await this.featureTypeStore.getAll();
            types.forEach(type => {
                this.featureTypes.set(
                    type.name.toLowerCase(),
                    type.lifetimeDays,
                );
            });
        }
        return features.filter(feature => {
            const diff = today - feature.createdAt.valueOf();
            const featureTypeExpectedLifetime = this.featureTypes.get(
                feature.type,
            );
            return (
                !feature.stale &&
                diff >= featureTypeExpectedLifetime * MILLISECONDS_IN_DAY
            );
        }).length;
    }

    private activeCount(features: IFeatureOverview[]): number {
        return features.filter(f => !f.stale).length;
    }

    private staleCount(features: IFeatureOverview[]): number {
        return features.filter(f => f.stale).length;
    }

    async calculateHealthRating(project: IProject): Promise<number> {
        const toggles = await this.featureToggleStore.getFeaturesBy({
            project: project.id,
        });

        const activeToggles = toggles.filter(feature => !feature.stale);
        const staleToggles = toggles.length - activeToggles.length;
        const potentiallyStaleToggles = await this.potentiallyStaleCount(
            activeToggles,
        );
        return this.getHealthRating(
            toggles.length,
            staleToggles,
            potentiallyStaleToggles,
        );
    }

    private getHealthRating(
        toggleCount: number,
        staleToggleCount: number,
        potentiallyStaleCount: number,
    ): number {
        const startPercentage = 100;
        const stalePercentage = (staleToggleCount / toggleCount) * 100 || 0;
        const potentiallyStalePercentage =
            (potentiallyStaleCount / toggleCount) * 100 || 0;
        const rating = Math.round(
            startPercentage - stalePercentage - potentiallyStalePercentage,
        );
        return rating;
    }
}
