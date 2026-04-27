# Hetzner as the virtual private server provider

DATE: 2026-04-27

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

A prior decision (`2026-04-27-vps-as-hosting-model`) establishes that the system
is deployed to a virtual private server running Linux under the project's
administrative control. That decision explicitly defers the choice of provider.
This decision answers that question. The relevant considerations at the provider
level are machine specifications relative to price, datacenter locations
relative to the project's target audience, the operational simplicity of the
control panel and provisioning workflow, and the availability of adjacent
services such as object storage that the project may need without intending to
build around a cloud ecosystem.

## DECISION

The virtual private server is provisioned through Hetzner.

## ALTERNATIVES CONSIDERED

**Amazon Web Services EC2**: The most widely recognised virtual machine
offering, with the broadest managed services ecosystem and global datacenter
coverage. Familiarity with the AWS control plane, IAM, security groups, and VPC
configuration is common among infrastructure contributors. Rejected primarily on
cost grounds. An EC2 instance with specifications adequate for running the full
system, two virtual CPUs and four gigabytes of RAM, costs approximately thirty
dollars per month on demand. Equivalent specifications on Hetzner cost roughly
four euros per month. The AWS pricing includes implicit charges for egress,
snapshots, and Elastic IP addresses that compound the base cost. The managed
services ecosystem that justifies AWS complexity and pricing, RDS, ECS,
CloudFront, and their integrations, is not a dependency the project intends to
incur at this stage. The object storage concern that might otherwise favour AWS
is addressed separately below. AWS familiarity is a genuine asset but its value
is highest when consuming AWS-specific managed services; for a single Linux
machine running Docker Compose, that familiarity does not transfer to a
meaningful operational advantage.

**DigitalOcean**: A managed cloud provider positioned between raw VPS providers
and full cloud platforms. Droplet pricing is reasonable, roughly twelve to
eighteen dollars per month for usable specifications, and the control panel has
a good developer experience with clear documentation. The managed services
offering, including managed PostgreSQL and an S3-compatible object store called
Spaces, is modest but adequate. Rejected because the price-to-specification
ratio is materially worse than Hetzner's without a compensating capability
advantage for the project's current requirements.

**Vultr**: Pricing and specifications comparable to DigitalOcean, with a smaller
ecosystem and less documentation. No material advantage over DigitalOcean or
Hetzner for this use case. Rejected on the same grounds as DigitalOcean and
without the minor advantages DigitalOcean offers in documentation quality.

**Linode / Akamai Cloud**: Historically competitive pricing, recently absorbed
into the Akamai CDN organisation. Similar specifications and pricing to
DigitalOcean. The acquisition introduces uncertainty about the platform's
long-term direction and pricing model that the other alternatives do not carry.
Rejected on that basis in addition to the price-to-specification comparison with
Hetzner.

## RATIONALE

Hetzner provides the best price-to-specification ratio of the evaluated
providers by a significant margin. A CX22 instance, two AMD virtual CPUs and
four gigabytes of RAM on NVMe storage, costs approximately four euros per month.
This is adequate for running the Go application server, the Python calculation
engine, and PostgreSQL simultaneously with meaningful headroom, and it is an
order of magnitude cheaper than equivalent AWS EC2 pricing. For an open source
project without revenue, the cost difference over a twelve-to-twenty-four month
horizon is not negligible. Hetzner operates datacenters in the United States,
specifically Ashburn, Virginia and Hillsboro, Oregon, making latency to the
project's primary target audience, retail investors in the US, comparable to any
US-based provider. The control panel is straightforward, provisioning is
immediate, and the operational workflow for a single Linux machine is no more
complex than any other provider. Hetzner also offers S3-compatible object
storage priced at approximately 0.0055 euros per gigabyte per month, which is
sufficient for database backup storage if that need arises, without requiring
any dependency on a cloud ecosystem.

## CONSEQUENCES

**Positive**: server cost is low and fixed. US datacenter locations are
available, making latency to the primary audience comparable to US-based
providers. S3-compatible object storage is available from the same provider at
negligible cost if backup storage is needed. The operational workflow is
straightforward.

**Negative**: Hetzner is a smaller organisation than AWS or DigitalOcean.
Support response times and SLA guarantees are less extensive than those of
larger providers. The managed services ecosystem is minimal; if the project
later requires managed database failover, global CDN integration, or distributed
infrastructure, Hetzner is not the appropriate platform for those services and
migration or a multi-provider arrangement would be required.

**Neutral**: the specific instance type, datacenter location within the
available options, and any adjacent services such as object storage or backups
are operational configuration decisions that do not require an ADR.
